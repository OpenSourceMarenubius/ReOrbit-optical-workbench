# ReOrbit Optics

Recycle ideas. Explore new worlds.

A local-first optical design prototype with an editable sequential prescription, an exact spherical ray trace, a geometric spot diagram, and best-focus adjustment. No account, licence server, package installation, or runtime network access required.

Spherical and plane intersections are analytic; conic/even-aspheric intersections use a bounded numerical solver. Refracting wedge prisms use tilted plane interfaces. Ideal plane, spherical and aspheric mirrors support folded sequential paths.

## Use from any computer

[Open ReOrbit in your browser](https://opensourcemarenubius.github.io/ReOrbit-optical-workbench/). This is the GitHub Pages address; it becomes available after Pages is enabled and the deployment succeeds. No installation or account is needed to use the workbench.

Saved designs stay in the current browser. To move or share a design, choose **Save project**, transfer the JSON file, and choose **Open JSON** on the other computer. Localhost, downloaded copies and the hosted website have separate browser storage; designs do not automatically sync to GitHub.

To use offline, download this repository as a ZIP, extract it and open `index.html`. Keep all runtime files together.

## Run

Open `index.html` directly, or run `npm start` and visit http://127.0.0.1:4173. Node.js is required only for the optional local server and tests. Run `npm test` to check the engine against analytic refraction, a parallel plate, and the thick lensmaker equation, plus focus and clipping cases.

## Use

Choose an example, edit the prescription, then select **Find best focus** for a converging system. Click a material in the **Medium after** column to search the glass catalogue. **Save project** downloads a JSON file; **Open JSON** restores it. Browser storage saves the latest valid prescription when available. Switching examples replaces the current work; export first to retain a durable copy.

## Search optical glasses

The material picker includes **365 SCHOTT glass entries plus ideal AIR**, extracted from SCHOTT's public June 2025 AGF catalogue. Search by full or partial glass name, manufacturer or catalogue description, without case sensitivity. Search punctuation is flexible; selected materials retain their exact catalogue designation. Results show n at the project's wavelength, catalogue nd / Vd, and the declared dispersion range. Results outside that range are disabled, and the engine blocks extrapolation. The application's wavelength range remains 380–1700 nm.

The same picker is available in **Add optic**, so prisms and aspheric lenses can use any supported glass. The final interface must still exit into AIR. Selecting glass on a surface updates the medium immediately after that surface; it does not alter radii or thicknesses. Supplier ZMX imports resolve exact catalogue names too, including BK7, F2, SF2, N-SF11 and N-BAF10. Unknown names are blocked without substitution. BK7 and N-BK7 remain distinct records even when this catalogue supplies identical coefficients.

This is nominal dispersion data, not a stock list or melt certificate. Some catalogue entries are legacy/inquiry grades. The original ZIP and decoded AGF snapshot, SHA-256 hashes and an offline regeneration script are preserved; see [catalogue provenance](vendor/README.md). Of the source's 366 records, B270 is excluded because its dispersion formula is not yet implemented. Absorption/transmission, coatings, Fresnel power and temperature effects are not evaluated.

**Emission**, beside **Add surface**, controls the light source. Choose a collimated beam or a finite-distance point source. Set wavelength (380–1700 nm), emission direction (−15° to +15°), and, for a point source, distance before the first vertex (up to 10,000 mm) and emission cone half-angle (greater than 0° to 60°). A 5° half-angle is a 10° full cone. The source stays on the optical axis; direction tilts its cone in the meridional plane. The orange source marker appears in the layout. Point-source sampling is uniform in solid angle within that cone; input beam diameter applies only to collimated emission. Emission edits update the trace immediately and are preserved in JSON and autosave. Existing projects without emission settings retain their original collimated behaviour.

Coordinates are `[z, x, y]`, in mm. Each surface uses a local incoming axis; the initial axis is world +z. Positive radius places the centre of curvature along that incoming axis. Radius 0 is a plane. Thickness is positive vertex spacing along the nominal outgoing axis to the next surface; the final row's thickness is ignored. Material is the medium immediately after each surface. The system starts and ends in air. Image distance is measured from the last vertex along its outgoing axis, not from the principal plane. For collimated input, beam diameter is sampled in the first vertex plane and emission direction tilts the input in the x–z plane. The spot plot is centred on the sampled ray centroid. Layout and spot plots have independent scale bars; layout has equal mm scales on both axes.

For point sources, the layout aims its 11 rays at equally spaced heights on the illuminated portion of the actual curved first surface. This is a drawing sample; spot diagrams retain uniform-solid-angle sampling. A tilted or narrow cone can still illuminate only part of the lens. **Emission → Fill first lens** sets direction to 0° and calculates the cone half-angle needed to reach both first-aperture edges at the current distance. It changes the physical emission settings explicitly; the layout never redirects rays outside the configured cone to make it appear filled.

## Insert supplier lens (.zmx)

### Implementation provenance and public references

ReOrbit's ZMX importer was created using publicly available technical information, including the open-source **ray-optics** project's ZMX reader and its documentation as references for record conventions and text encoding. Credit goes to **Michael J. Hayford and the ray-optics contributors** for making that implementation available. ReOrbit supplies its own bounded JavaScript parser in [zemax.js](zemax.js); ray-optics is not a runtime dependency.

The reference material also includes Ansys's published documentation for file types, even-asphere parameters and mirror thickness conventions. Published vendor documentation is distinct from open-source software: citing it does not make the Zemax format, OpticStudio software, supplier prescriptions or vendor documentation MIT-licensed. ReOrbit does not bundle an OpticStudio SDK or proprietary runtime, and this project does not imply endorsement by Ansys, Zemax or ray-optics.

See [ZMX importer documentation and source credits](docs/ZMX_IMPORTER.md) for linked references, record mappings, supported and rejected features, validation coverage and a practical import checklist. The parser's implemented subset and tests define its current compatibility; the references are not a claim of complete Zemax support.

### Import workflow and compatibility

Select **Insert supplier lens** beside **Add surface**, then choose a local Zemax text `.zmx` file. The preview shows physical surfaces in mm and lists unsupported records and model limitations. No prescription changes occur until **Insert lens into prescription** is selected. Choose before the first surface, after the final surface, or an interior AIR gap; insertion inside glass is blocked. Specify the external air gaps. Interior insertion replaces that old air gap and shifts downstream surfaces; internal supplier thicknesses are kept. Appending retains the existing image distance measured from the new final vertex. Prepending retains source distance measured from the new first vertex. Wavelength, direction, emission model and project name remain as configured.

Supported files use UTF-8 or UTF-16 (LE/BE), sequential STANDARD spherical/plane/conic or EVENASPH surfaces, circular centred clear apertures, AIR or exact supported catalogue glasses, and explicit MM/CM/M/IN units. ZMX CURV is reciprocal radius in source units; DIAM is a clear semi-diameter, so both are converted for ReOrbit. CONI is the dimensionless conic constant. EVENASPH PARM 1–8 map to A2–A16; each coefficient is converted with scale^(1−order), not a single common length scale. Higher parameter numbers, duplicate parameter records and other asphere families are rejected. Complete files must include object SURF 0 and a final planar image surface; these two surfaces and their external distances are excluded. Source-file name, title, source surface number and comments are retained in each inserted surface's JSON metadata. Imported values remain editable. `GLAS MIRROR` imports ideal reflective surfaces; signed Zemax distances and subsequent radii/asphere coefficients are converted to positive path spacing and local incoming coordinates. Coordinate breaks remain unsupported.

Glass names absent from the supported catalogue, unsupported asphere families, coordinate breaks, non-circular/decentred apertures, explicit pickup solves, multiple configurations, binary `.zos`, `.zar` archives and unknown optical records block insertion. No substitute glass or approximate spherical model is silently used. Coatings, stops, mechanical data and ignored system settings produce notices. Optimisation variables are frozen at their saved numeric values; constraints are not imported. The 24-surface limit and existing geometric checks also apply. This is a bounded importer, not a complete Zemax interpreter. Prism coordinate-break files are not imported; define supported wedge prisms using Add optic or edit their faces manually.

**Undo insertion** restores the previous prescription until another edit or reload. Export JSON for a durable project copy. The clearly labelled [demo ZMX](tests/fixtures/demo-singlet.zmx) is an illustrative regression fixture, not a supplier-verified commercial lens. Import compatibility has been checked with synthetic format fixtures; a live downloaded supplier file has not yet been independently verified.

401 samples use a uniform-area sunflower disk plus the central ray for collimated emission, or a uniform-solid-angle cone plus its axis for point emission. The ray count is geometric sampling, not optical transmission. Best focus analytically minimises the sum of centroid-referenced transverse variances at the current wavelength/direction for rays that survive the trace. Paraxial EFL always uses a collimated near-axis on-axis ray in air, independent of source distance. Clipped, missed, backward, total-internal-reflection and image-before-exit rays are excluded from spot statistics.

## Mirrors, prisms and aspheric lenses

**Add optic** appends a mirror, a refracting wedge prism or a plano-aspheric lens with searchable glass selection. Set its clear diameter, centre thickness and preceding air gap. Prism faces use opposite half-apex tilts (apex angle up to 60°). The aspheric lens starts with a configurable front vertex radius, conic constant and A4 term, and a plane exit face. These are editable starting geometries, not optimised supplier parts. Undo insertion restores the previous design until another edit.

Click any surface's **shape / gear** button to choose spherical/plane, conic plus even asphere, or prism plane. Aspheres use z(r) = c·r² / [1 + sqrt(1 − (1+k)c²r²)] + Σ A(2j)·r^(2j), j=1…8. Radius is 1/c (0 means zero base curvature); coefficients A2…A16 use mm^(1−order). The solver uses the analytic sag gradient for Snell refraction, conservative axial bounds, a sign-change search and bisection. Undefined/vertical conic profiles, excessive slope bounds (>10), crossing surfaces and geometry whose separation cannot be verified are rejected. Numerical intersection at grazing/tangent contacts is not guaranteed and still needs independent qualification.

**Mirror** offers a tilted plane, sphere or conic/asphere. A 45° plane folds the nominal path by 90°; negative radius gives a concave mirror. Use the shape editor to change reflection/refraction and A2–A16. The reflected local frame carries downstream elements, image plane and best-focus calculations. Mirrors retain the incident medium and assume ideal reflection without a substrate, coating losses or back-surface ghosts.

Prism face tilt θ is defined by z = vertex + tan(θ)·x, with a circular clear aperture projected into the x–y plane. Thickness is axial vertex spacing, not minimum edge thickness. The drawing connects the faces into a wedge, but side walls are not optically traced. Rays advance along the local sequential path; TIR at a refracting face is reported and terminates the ray. No internally reflected/folded right-angle, Porro, roof or other multi-bounce prism paths are modelled. Tilted curved/aspheric surfaces remain unsupported. Paraxial EFL is left blank for systems containing prism faces because the centred-system EFL calculation does not apply.

## Surface and group focal distances

Each prescription row has a editable **Surface BFD** (back focal distance) and a focal-group checkbox. Surface BFD describes that interface alone, using the actual preceding and following media at the current wavelength; it is not the focal length of a complete lens. Select both lens faces, or any continuous range of surfaces, to display group EFL, back focal distance and front focal position in **Explore focal lengths**. Select all/Clear are available. A selection with holes gives no number until **Include intervening surfaces** is chosen. Selection is temporary and does not change the saved prescription.

Enter a nonzero focal target in any surface BFD field and press Enter or leave the field to solve its radius. For a selected group, choose **Adjust radius of**, then edit group EFL, BFL or front focus position. Only that radius changes; all other radii, spacings, glass and asphere coefficients remain fixed. Enter `∞`, `inf` or `infinity` for zero paraxial power. Finite zero, malformed targets, equal-index refracting interfaces, tilted planes, singular solves and invalid resulting geometry are rejected without changing the prescription. Solves apply at the current wavelength; they are edits, not persistent constraints when wavelength or glass subsequently changes.

Group calculations include every selected interface, glass thickness and internal air gap; the gap after the last selected face is excluded. They retain the actual boundary media, even when selecting inside glass. EFL is measured from the rear principal plane; BFL is measured from the last vertex along the outgoing axis. Front focus is signed from the first vertex along the incoming axis. Negative BFL means a virtual focus. Afocal groups show infinity. These are paraxial on-axis properties, independent of source conjugate, pupil clipping and image-plane position; use Find best focus for the finite sampled source bundle.

The implementation multiplies reduced-angle matrices for [height, n·angle]: surface power Φ=(n_out−n_in)·c, propagation t/n, and mirror power Φ=−2n·c in unfolded coordinates. Effective vertex curvature c=1/R+2A2 for even aspheres (1/R=0 for a plane base); conic and A4–A16 terms do not change paraxial vertex power. For total matrix [A B; C D], rear EFL=−n_out/C, BFL=−n_out·A/C, and front focal position=n_in·D/C. Plane mirror folds are supported; tilted refracting faces explicitly have no scalar centred focal-length result. References: [optrace matrix analysis](https://drocheam.github.io/optrace/details/matrix_analysis.html), [BYU Optics, chapter 9](https://optics.byu.edu/docs/opticsbook.pdf).

## Transmitter design assistance

**Beam diagnostics** reports geometric angular RMS, sampled envelope diameter, centroid-referenced RMS radius and ray survival. Diameters are sampled ray envelopes, not Gaussian 1/e² widths; survival is not optical efficiency. These calculations help investigate clipping, residual collimation and spacing changes. They do not establish emitted power, diffraction-limited divergence or link range.

The [illustrative 1550 nm Galilean stage](examples/galilean-concept.json) assumes a collimated input after an unspecified first collimator. It is not a measured or supplier-qualified transmitter prescription. Load it with Open JSON to investigate spacing and geometric collimation.

## Model boundaries

Centred rotationally symmetric spherical/conic/even-aspheric refractive or reflective surfaces, tilted plane mirrors and prism planes. AIR is n=1. Supported catalogue glasses use Sellmeier dispersion, limited here to 380–1700 nm. One wavelength and emission direction per calculation. Sources are collimated beams or ideal on-axis points with a uniform angular cone. No extended emitters, Gaussian intensity profile, Fresnel losses, coatings, absorption, diffraction, polarisation, wavefront, MTF, freeforms, automatic internally reflected prism paths, tolerancing, general lens-parameter optimisation, or non-sequential tracing. Folded tracing follows the prescribed surface sequence; arbitrary intervening objects and obstructions are not detected. Examples are illustrative and have not been qualified for manufacture. The Galilean example is a concept and is not an optimised collimator.

This is an early engineering tool, not an OpticStudio/OSLO equivalent. Independent comparison and physical validation are still needed before optical sign-off.

## Sources

- [SCHOTT N-BK7 datasheet](https://media.schott.com/api/public/content/41e799d0bf874807a0bb8e702fbb75b5?v=54856406): Sellmeier coefficients and tabulated refractive indices.
- [Physically Based Rendering: Specular Reflection and Transmission](https://www.pbr-book.org/3ed-2018/Reflection_Models/Specular_Reflection_and_Transmission): vector refraction and total internal reflection.
- [Ansys: Zemax file extensions](https://optics.ansys.com/hc/en-us/articles/42661745091603-Zemax-file-extensions): text ZMX versus binary ZOS and archive formats.
- [Ray-optics ZMX reader documentation](https://ray-optics.readthedocs.io/en/stable/_modules/rayoptics/zemax/zmxread.html): cross-check of ZMX record conventions and text encodings. ReOrbit has its own bounded JavaScript parser.
- [Ansys Even Asphere definition](https://ansyshelp.ansys.com/public/Views/Secured/Zemax/v26103/en/OpticStudio_User_Guide/OpticStudio_Help/topics/Even_Asphere.html): conic sag and PARM 1–8 coefficient order convention.

## Next useful milestones

1. Broader independent reference prescriptions and regression cases.
2. Multiple fields/wavelengths and ray-fan diagnostics.
3. Obstructions, non-sequential collisions and internally reflecting prism paths.
4. Additional manufacturer/dispersion models, aperture stops/pupils, and extended/off-axis emitters.
5. Gaussian beam propagation, then bounded optimisation and tolerances.

No commercial name or trademark availability check has been performed for “ReOrbit Optics.”

## GitHub Pages deployment

In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. The included workflow runs the tests, copies only the browser runtime into `_site`, and deploys after pushes to `main`. Pull requests run tests without deploying. The Actions tab shows deployment progress.

Run `node --test tests/*.test.cjs` for local checks and `node scripts/build-pages.cjs` to prepare the static files. Node 22 is used in CI; the browser app itself needs no Node installation.

## License and data

ReOrbit application code is released under the [MIT License](LICENSE). The SCHOTT catalogue files and numerical data retain their original source attribution; see [catalogue provenance](vendor/README.md). This project does not claim ownership of SCHOTT trademarks or third-party source materials.
