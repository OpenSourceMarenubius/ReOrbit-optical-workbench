# ZMX importer: implementation, references and compatibility

ReOrbit imports a limited subset of sequential Zemax text prescriptions into editable optical surfaces. The goal is to reuse supported lens geometry with an explicit preview of what is retained, omitted or rejected. It is not a general OpticStudio file converter.

## How the importer was created

Publicly available information, including open-source work, informed the importer's creation. In particular, Michael J. Hayford's **ray-optics** ZMX reader and its published source documentation provided a reference for text encodings and record conventions. We acknowledge Hayford and the ray-optics contributors for that work.

ReOrbit implements its browser-facing parser in [zemax.js](../zemax.js), with geometry and material validation supplied by [engine.js](../engine.js) and [glasses.js](../glasses.js). It does not load the Python ray-optics package, run OpticStudio or require a vendor SDK. Its handling rules are deliberately narrower than those of the reference software. The acknowledgement describes sources consulted during development; it does not assert that ReOrbit has ray-optics's feature coverage or has been certified against it.

### Reference ledger

References reviewed on 2026-11-03. Upstream links can change; these are reference locations, not vendored snapshots or a complete formal ZMX specification.

| Reference | How it informed this work | Source status |
| --- | --- | --- |
| [ray-optics ZMX reader documentation and source](https://ray-optics.readthedocs.io/en/stable/_modules/rayoptics/zemax/zmxread.html), documentation labelled 0.9.8 | Cross-check of encoding handling and ZMX record interpretation | Open-source project by Michael J. Hayford and contributors; see its [BSD 3-Clause license](https://github.com/mjhoptics/ray-optics/blob/master/LICENSE) and [repository](https://github.com/mjhoptics/ray-optics) |
| [Ansys: Zemax file extensions](https://optics.ansys.com/hc/en-us/articles/42661745091603-Zemax-file-extensions) | Distinction between lens text files and other file containers | Published vendor documentation; not an open-source software license |
| [Ansys: Even Asphere](https://ansyshelp.ansys.com/public/Views/Secured/Zemax/v26103/en/OpticStudio_User_Guide/OpticStudio_Help/topics/Even_Asphere.html), Release 2026 R1.03 | Conic/even-polynomial definition and parameter ordering | Published vendor documentation |
| [Ansys: Thicknesses](https://ansyshelp.ansys.com/public/Views/Secured/Zemax/v252/en/OpticStudio_User_Guide/OpticStudio_Help/topics/Thicknesses.html), Release 2025 R2 | Signed real-propagation spacing after reflection | Published vendor documentation |
| [SCHOTT catalogue provenance](../vendor/README.md) | Exact glass identities, dispersion coefficients and wavelength limits | Third-party catalogue data with preserved source files and hashes; separate from parser implementation |

ReOrbit application code is offered under its [MIT license](../LICENSE). That license does not relicense the referenced projects, vendor documents, file format or imported supplier designs. Source names and trademarks identify interoperability references, not affiliation or endorsement. No OpticStudio proprietary source or runtime is included in this repository.

## Supported input and record mapping

The file picker reads the selected file locally in the browser. The importer does not upload it to a conversion service. Acceptable text encodings are UTF-8 and UTF-16 little/big endian, with BOM handling and detection of common BOM-less UTF-16 patterns. Windows and Unix line endings are supported. Inputs above 1,000,000 bytes are rejected before decoding; invalid text and binary control characters are rejected.

| Input | ReOrbit treatment |
| --- | --- |
| `MODE SEQ` / `SEQUENTIAL` | Sequential geometry only; non-sequential mode is rejected |
| `UNIT MM`, `CM`, `M`, `IN` / `INCH` | Explicit conversion to millimetres; missing or conflicting units are rejected |
| Consecutive `SURF` records starting at 0 | Requires a complete object–optic–image sequence; object and final image are STANDARD planes in AIR and are omitted from insertion |
| `TYPE STANDARD` | Sphere or plane; a nonzero conic becomes a conic/aspheric surface |
| `TYPE EVENASPH`, `CONI`, `PARM 1–8` | Conic and even coefficients A2 through A16; duplicate or higher parameter numbers are rejected |
| `CURV` | Reciprocal radius in source units; zero means a plane |
| `DISZ` | Internal vertex spacing, converted to mm; the last physical surface's external image distance is not imported |
| `DIAM` | Positive clear semi-diameter becomes full clear diameter; only the supported centred circular aperture flags are accepted |
| `GLAS` | Exact supported catalogue material or AIR; unknown materials and model-glass solves are blocked without substitution |
| `GLAS MIRROR` | Ideal reflection retaining the incident medium; signed propagation is converted to ReOrbit's local folded coordinates |
| `NAME`, `COMM` | Descriptive title and surface comments retained with source filename and surface number in project metadata |

For length scale `s` (mm per source unit), radius and spacing multiply by `s`. An even coefficient of order `m` multiplies by `s^(1−m)`. This matters when importing centimetre or inch prescriptions: a single common multiplier for all asphere coefficients would be incorrect.

Mirror handling tracks reflection parity when converting radii, even coefficients and internal spacings. Internal distances must describe real forward propagation under the file's mirror sign convention; zero, infinite or incorrectly signed internal gaps are rejected. Coordinate-break records remain unsupported even though manually defined plane mirrors can fold a ReOrbit layout.

## Notices, omissions and rejection rules

The preview is part of the import workflow: inspect both its errors and warnings before inserting.

- `STOP` is treated as a surface aperture, with a notice; stop/pupil solving is not transferred.
- `COAT` produces a notice; coating efficiency and phase are not calculated.
- Recognised mechanical/drawing records produce notices; the traced aperture comes from `DIAM`.
- Recognised system metadata, including wavelength, field and optimisation settings, does not configure the current ReOrbit system. A general preview notice explains that saved numeric geometry is imported while system settings and optimisation constraints are not transferred.
- Unsupported surface types, coordinate breaks, non-circular/decentred apertures, explicit pickup solves, multiple configurations, unknown optical records and non-default ignore flags block insertion. Renaming a binary `.zos`, archive `.zar` or encrypted model to `.zmx` does not convert it.
- Import must contain a supported glass or mirror optic and exit into AIR. ReOrbit's geometry, dispersion-domain and 24-surface capacity checks also apply.

## Insertion and checking a supplier prescription

1. Save the current project as JSON before experimenting.
2. Choose a supplier's sequential text prescription, then inspect the preview. Match radii, centre thicknesses, clear apertures, glasses and units against the supplier's drawing or prescription.
3. Resolve errors and assess every omission notice. A successful parse means the implemented subset was accepted; it does not establish that omitted settings are irrelevant to your design.
4. Choose an AIR insertion location and external gaps. ReOrbit retains the current source, wavelength and image distance. Confirm those settings separately for the intended operating conditions.
5. Insert, inspect the traced geometry and save the resulting JSON. Undo insertion is available until another edit or reload. Validate important results against an independent calculation or optical tool and physical measurements.

Insertion validates a candidate project before replacing the active prescription. A rejected candidate leaves the current design unchanged. Source metadata records where each inserted surface came from; it is not a supplier authenticity or revision certificate.

## Validation evidence and current limits

[Importer tests](../tests/zemax.test.cjs), [asphere tests](../tests/advanced-optics.test.cjs), [mirror tests](../tests/mirrors.test.cjs) and [glass tests](../tests/glasses.test.cjs) exercise conversions, encodings, rejection rules, material matching, reflection signs and atomic insertion. Run the repository suite with `node --test tests/*.test.cjs`.

The [demo singlet](../tests/fixtures/demo-singlet.zmx) and constructed format variants are synthetic regression cases. They are not supplier-certified commercial prescriptions. A live supplier file has not yet been independently qualified as part of this validation set, and no blanket compatibility with a particular supplier or OpticStudio release is claimed.

To report a compatibility problem, provide the failing record/error and, where sharing is permitted, a minimal reproducible file with its units and expected geometry. Keep a supplier's original file unchanged and distinguish a genuine missing feature from a malformed or incomplete export.
