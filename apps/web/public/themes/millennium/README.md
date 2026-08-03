# Millennium theme art

Two optional files. The theme is complete and correct without them — they add a figure
standing behind each page, and nothing else on the panel depends on them. A `url()` that
404s paints nothing, so an absent file costs a request and shows no error.

| File | Where it goes |
| --- | --- |
| `weather-figure.png` | Behind the weather page, bled off the **bottom-left** |
| `pulse-figure.png` | Behind Search Pulse, bled off the **bottom-right** |

**PNG with transparency, roughly 2:3 portrait.** The theme sizes them to 66% of the panel
height and pins them to the bottom edge, so crop each figure so it *stands on* the bottom
of its own canvas — leave no transparent margin below it, or it floats.

They are drawn as the page's own background, above the carved stone and beneath every
band, and the bands above are veiled rather than opaque so a figure reads through them.
That is why these want to be **single figures on transparency, not full scenes** — a busy
rectangle behind five trend rows turns into noise, where one silhouette reads as depth.

To dial how strongly they come through, there is one number: the alpha in the two
`linear-gradient(rgba(21, 15, 10, 0.84) …)` washes in `apps/web/src/styles/millennium.css`.
Lower shows more of the figure. Check it against Search Pulse rather than the weather page
— that screen has the most text over the art and is the first place a too-bold figure
starts costing legibility.
