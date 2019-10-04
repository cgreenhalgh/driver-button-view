var https = require("https");
var http = require("http");
var express = require("express");
var bodyParser = require("body-parser");
var databox = require("node-databox");
var WebSocket = require("ws");

const DATABOX_ARBITER_ENDPOINT = process.env.DATABOX_ARBITER_ENDPOINT || 'tcp://127.0.0.1:4444';
const DATABOX_ZMQ_ENDPOINT = process.env.DATABOX_ZMQ_ENDPOINT || "tcp://127.0.0.1:5555";
const DATABOX_TESTING = !(process.env.DATABOX_VERSION);
const PORT = process.env.port || '8080';

//server and websocket connection;
let ws, server = null;
//cached ui state
let uimessages = [];

function updateui(msg) {
	// at present only one :-)
	uimessages = [msg];
	if (ws) {
		let json = JSON.stringify(msg)
		try {
			ws.send(json);
		} catch (err) {
			console.log(`error sending ws message`, err)
			try { ws.close(); } catch (err) {}
			ws = null;
		}
	}
}

const store = databox.NewStoreClient(DATABOX_ZMQ_ENDPOINT, DATABOX_ARBITER_ENDPOINT);

//create store schema for button pressed
const pressedMetadata = {
	...databox.NewDataSourceMetadata(),
	Description: 'Button pressed',
	ContentType: 'application/json',
	Vendor: 'Databox Inc.',
	DataSourceType: 'button-view-pressed:1',
	DataSourceID: 'button-view-presed',
	StoreType: 'ts/blob',
}

//create store schema for html actuator
const htmlMetadata = {
	...databox.NewDataSourceMetadata(),
	Description: 'Button appearance',
	ContentType: 'application/json',
	Vendor: 'Databox Inc.',
	DataSourceType: 'button-view-html:1',
	DataSourceID: 'button-view-html',
	StoreType: 'ts/blob',
	IsActuator: true,
}

// state
let state = {
	pressed: 0,
	epoch: (new Date()).toISOString()
};

///now create our stores using our clients.
store.RegisterDatasource(pressedMetadata).then(() => {
	console.log("registered pressed metadata");
	//now register the actuator
	return store.RegisterDatasource(htmlMetadata)
}).catch((err) => { console.log("error registering datasources", err) }).then(() => {
	console.log("registered htmlMetadata, observing", htmlMetadata.DataSourceID);
	store.TSBlob.Observe(htmlMetadata.DataSourceID, 0)
	.catch((err) => {
		console.log("[Actuation observing error]", err);
	})
	.then((eventEmitter) => {
		if (eventEmitter) {
			eventEmitter.on('data', (data) => {
				console.log("[Actuation] data received ", data);
				handleHtml(data);
			});
			eventEmitter.on('error', (err) => {
				console.log("[Actuation error]", err);
			});
		}
		// previous messages
		store.TSBlob.Latest( htmlMetadata.DataSourceID )
		.then((message) => {
			handleHtml(message);
		})
		.catch((err) => {
			console.log(`error handling old value`, err);
		})
	});
});

function handleHtml(data) {
	console.log(`addMessage`, data);
	let msg = data.data;
	updateui(msg);
}

//set up webserver to serve driver endpoints
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('views', './views');
app.set('view engine', 'ejs');

app.get("/", function (req, res) {
    res.redirect("/ui");
});

app.get("/ui", function (req, res) {
	res.render('index', { testing: DATABOX_TESTING });
});

app.post('/ui/pressed', (req, res) => {
	let msg = {
		pressed: state.pressed++,
		epoch: state.epoch
	}
	console.log(`pressed! ${msg.pressed}`)
	store.TSBlob.Write(pressedMetadata.DataSourceID, msg)
	.then(() => console.log(`persisted pressed ${msg.pressed}`))
	.catch((err) => console.log(`error persisting pressed ${msg.pressed}`, err))
	res.send({success:true})
});
app.get("/status", function (req, res) {
    res.send("active");
});

//when testing, we run as http, (to prevent the need for self-signed certs etc);
if (DATABOX_TESTING) {
    console.log("[Creating TEST http server]", PORT);
    server = http.createServer(app).listen(PORT);
} else {
    console.log("[Creating https server]", PORT);
    const credentials = databox.GetHttpsCredentials();
    server = https.createServer(credentials, app).listen(PORT);
}

//finally, set up websockets
const wss = new WebSocket.Server({ server, path: "/ui/ws" });

wss.on("connection", (_ws) => {
	if (ws) {
		try { ws.close(); } catch (err) {}
		ws = null;
	}
	ws = _ws;
	_ws.on('error', (err) => {
		console.log(`ws error: ${err}`);
		if (ws === _ws) {
			try { _ws.close(); } catch (err) {}
			ws = null;
		}
	});
	console.log("new ws connection -sending state");
	// send cached state
	for (var msg of uimessages) {
		try {
			ws.send(JSON.stringify(msg))
		} catch (err) {
			console.log(`error sending cached ws message`, err);
		}
	}
});

wss.on("error", (err) => {
	console.log("websocket error", err);
	if (ws) {
		ws = null;
	}
})
