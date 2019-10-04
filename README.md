# Databox Driver Button	View

A driver to display a button, which can change appearance
and be pressed. Initially mostly for testing. 

Status: v1

Todo: 
- multiple buttons?
- css support
- svg appearance?
- full screen?
- multiple buttons?

Chris Greenhalgh, The University of Nottinhgam, 2019.

## Data source

For button presses the datasource type is "button-view-pressed:1".
The store type is ts/blob.
The data type is a JSON object with fields:
- `pressed` (number) number of times button has been pressed since epoch
- `epoch` (string) ISO date/time of epoch (driver start)

e.g.
```
{
  "data": {
    "pressed": 1,
    "epoch":"2019-10-04T08:03:34.735Z"
  },
  "timestamp": 123456789
}
```

For button appearances the actuator/datasource type is
"button-view-html:1".
The store type is ts/blob.
The data type is a json object with:
- `html` (string) html to display as button content

e.g.
```
{
  "html":"<p>Some test<p>"
}
```

Currently this is put into a div with very basic styling
(full width, grey background, darker when active, thin border).

(future extensions include specific support for svg, style sheets, etc.)


