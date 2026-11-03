# SCHOTT catalogue provenance

The public numerical data were downloaded from SCHOTT's optical-glass product page on 2026-11-02 (America/Regina).

- [Product/download page](https://www.schott.com/en-us/products/optical-glass-p1000267)
- [Original public ZIP](https://media.schott.com/api/public/content/a79c07aa61da4c05a2c0bbab93d09a7f?download=true&v=3b65e351)
- Archive entry: `schott glasses preferred and special June-2025-B.AGF`
- Preserved ZIP: `schott-zemax.zip`
- Decoded UTF-8 AGF snapshot: `schott-june-2025.agf`
- ZIP SHA-256: `448c1ae62ed661f4e6e5e20fe5c30ddefeed9187fe4b5786a848e2bec7ef6047`
- Decoded AGF SHA-256: `657e8c97718faee9a5b58e6308eb9608f94f991a0cb0ac5f5cc69c9e8e540371`

`node scripts/build-glass-catalog.cjs` extracts numerical NM/CD/LD records and GC descriptions into `glass-data.js`. Of 366 source entries, 365 use three-term Sellmeier dispersion (AGF formula 2); these are supported, plus an ideal AIR medium. B270 uses formula 1 and is explicitly excluded. Coefficients CD are interleaved B1,C1,B2,C2,B3,C3; wavelengths and C values use micrometres and micrometres squared. LD bounds are converted to nm. Catalogue nd and Vd are retained for display and independent consistency checks.

Names are exact catalogue identities; no material substitution is made. For example, BK7 and N-BK7 are distinct records even where this catalogue supplies identical dispersion coefficients. The catalogue includes legacy, inquiry and specialty entries and does not establish current supply availability. These data are nominal catalogue values, not melt-specific measurements. Absorption, temperature, coating and Fresnel effects remain outside the ray model.
