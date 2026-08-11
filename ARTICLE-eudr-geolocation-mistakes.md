# Four ways an EUDR Due Diligence Statement is invalid before anyone looks at the deforestation

*11 August 2026 · Alexander Balieu, Luxembourg*

EUDR applies to large and medium operators from **30 December 2026**, and to small and micro
operators from **30 June 2027**. A simplification package was in trilogue as this was written
and is not binding; the current deadlines stand until amended in the Official Journal.

Most of the preparation effort I see goes into the hard question — *was this land deforested
after 31 December 2020?* That question needs satellite data, supplier engagement and money.

But a Due Diligence Statement can fail long before anyone gets to it, on the structure of the
statement itself. These failures are cheap to find and nobody is looking for them, because
the file parses, the upload succeeds, and nothing complains.

Here are the four I see most, in rough order of how quietly they fail.

---

## 1. The coordinate swap

GeoJSON positions are `[longitude, latitude]`. Almost every other tool a person touches —
Google Maps, phone GPS readouts, most spreadsheets — presents them as *latitude, longitude*.

A cocoa plot at 6.70° N, 1.20° W is:

```json
{ "type": "Point", "coordinates": [-1.20, 6.70] }
```

Write it the way it was read to you and you get:

```json
{ "type": "Point", "coordinates": [6.70, -1.20] }
```

That is a valid coordinate. It is in the South Atlantic, about 600 km off the coast of Gabon.
The JSON is well-formed, the schema validates, the upload succeeds, and your statement now
asserts that your cocoa was grown in the ocean.

Nothing catches this except a bounds-and-plausibility check, or someone eventually looking at
a map. **Check the sign and the order on every plot before submission**, especially any plot in
the western hemisphere or the southern hemisphere, where a swap can still land on dry ground
and become genuinely hard to spot.

## 2. The unclosed ring

A GeoJSON polygon's linear ring must repeat its first position as its last. This is easy to
state and easy to lose: several export paths — hand-edited files, some GIS exports, most
naive conversions from a list of corner points — drop the closing position.

```json
"coordinates": [[[-1.20,6.70],[-1.19,6.70],[-1.19,6.71],[-1.20,6.71]]]
```

Four positions, no closure. Strictly, not a polygon. Different consumers will do different
things with it: some close it silently, some reject it, some compute an area from an open
path. You do not want your statement's meaning to depend on which one reads it.

Related and worse: the **self-intersecting ring**, where the corner order is wrong and the
boundary crosses itself. A bowtie has no well-defined interior, so its area is meaningless
and any containment test against it is wrong. This happens whenever plot corners are recorded
in the order someone walked them rather than in sequence around the boundary.

## 3. The 4-hectare rule, applied to the wrong number

Plots above **4 hectares** must be given as a polygon. At or below 4 ha, a point is accepted.

The mistake is not usually ignorance of the rule — it is a mismatch between the declared area
and the geometry supplied. A statement that declares 10 hectares and provides a single
coordinate is internally contradictory on its face, and it is the kind of contradiction that
is trivial to detect automatically and therefore likely to be detected.

The subtler version: the declared hectares and the polygon disagree. If your stated area and
your computed area differ by more than a factor of two, one of them is wrong — and in my
experience it is almost always a unit error (acres, or square metres entered as hectares) or
the coordinate swap from mistake 1 distorting the geometry.

A caution on the threshold itself: any area computed from lat/lon by a simple projection is
indicative, not survey-grade. **Do not use a computed area to decide the 4 ha question in a
marginal case.** Use the cadastral or surveyed figure and supply a polygon if there is any doubt.

## 4. The assertion nobody writes down

A DDS is not a data dump. It is a **statement**, and the operator submitting it carries legal
liability for its contents. Two things are routinely missing:

**The cut-off assertion.** The statement must positively assert that the commodity was not
produced on land deforested after 31 December 2020. Supplying plot coordinates and production
dates is not the same as asserting this. Silence is not compliance.

**Legality of production.** EUDR requires the commodity to be produced in accordance with the
relevant legislation of the country of production — land use rights, environmental protection,
third-party rights, labour, tax, anti-corruption. This is a second, independent limb that a
geometry check says nothing whatsoever about, and it is the limb most likely to be
under-documented.

Internal consistency is worth a pass too. An HS code that maps to cocoa sitting beside a
declared commodity of coffee, an EORI number without its country prefix, a country of
production written as `Ghana` where an ISO 3166-1 alpha-2 code belongs — each of these is a
contradiction visible on the face of the document, and each is free to catch.

---

## A free checker

I built a validator for exactly these structural failures:

**https://reg.chainverdict.xyz/tools/eudr**

Paste a plot geometry or a draft DDS, get back what is wrong. Free, no signup, nothing stored
or logged. There is a paid API behind it for anyone with more plots than patience, but the
tool is free because the failure mode it catches is silent and the deadline is close.

**What it does not do, stated plainly:** it does not check deforestation. Not against
satellite imagery, not against any forest baseline, not at all. It does not verify legality of
production. It does not file anything with the EU Information System. It tells you whether
your statement is *well-formed*, which is necessary and nowhere near sufficient.

I am an independent professional in Luxembourg, not a customs agent and not a lawyer, and I
carry no professional indemnity cover. Treat this as a linting tool. Anything with legal or
financial consequence needs a qualified adviser.

Corrections and false positives: **contact@chainverdict.xyz**. If the checker is wrong about
something I would genuinely like to know.
