import { SITE_URL } from "@/lib/siteUrl";
import { FALLBACK_MARKETS } from "@/lib/markets";
import { REFERENCE_COUNT, REFERENCE_SPAN } from "@/lib/composite";

// ============================================================
//  WHAT THIS SITE IS, IN A FORM A SEARCH ENGINE CAN READ
//
//  A page's text says MMAI publishes a macro index built from official
//  statistics. A crawler cannot infer that from prose. JSON-LD says it
//  outright, and for a data site it is the difference between being
//  indexed as a blog and being indexed as a published dataset -- Google
//  runs a separate Dataset Search, and `Dataset` markup is what gets a
//  page into it.
//
//  EVERY FIELD HERE IS DERIVED OR TRUE. Structured data is a claim made
//  to a machine that will not check it, which makes it exactly the place
//  where an exaggeration survives longest. The market list, the market
//  count, the reference-window size and its span all come from the
//  engine rather than being typed, so none of them can drift from what
//  the site actually publishes -- the same rule the Learn page follows.
//
//  DELIBERATELY ABSENT:
//    - SearchAction. That tells Google the site has a search box it can
//      surface. It does not have one.
//    - AggregateRating / Review. Invented entirely.
//    - `distribution`. That advertises a downloadable file. The CSV and
//      Excel downloads are not built yet; when they are, this is where
//      they go.
//    - `sameAs`. There are no verified social profiles to point at.
// ============================================================

/** Published under the site's own name. MMAI is one person's project, so
 *  `Organization` rather than a corporate identity it does not have. */
function organisation() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "MMAI",
    alternateName: "Moshnib Macro Analysis Index",
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    description:
      "A transparent macro-market intelligence index — every formula published, every source licensed, no black box.",
  };
}

function website() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "MMAI",
    url: SITE_URL,
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

/** THE INDEX ITSELF, described as what it is.
 *
 *  `variableMeasured` lists the five indicators the score is built from,
 *  `spatialCoverage` the markets it covers, and `temporalCoverage` the
 *  reference window every score is ranked against. All three are read
 *  from the engine.
 *
 *  `isAccessibleForFree` is true and `creativeWorkStatus` is Published:
 *  both are simply the case, and both are fields Dataset Search reads. */
function dataset() {
  return {
    "@type": "Dataset",
    "@id": `${SITE_URL}/#dataset`,
    name: "MMAI — Moshnib Macro Analysis Index",
    description:
      `A daily macro-economic index covering ${FALLBACK_MARKETS.length} markets, built from five official ` +
      `indicators each — inflation, GDP growth, unemployment, the central bank policy rate and government ` +
      `debt — and expressed as a percentile rank against ${REFERENCE_COUNT} market-years of history. Every ` +
      `figure is traced to the institution that published it, with its own reporting date and licence.`,
    url: SITE_URL,
    // NO `license` FIELD, DELIBERATELY.
    //
    // It was written here as CC BY 4.0 and removed before shipping. The
    // site states no licence for its OWN output anywhere -- the licences
    // it publishes are the ones its SOURCES grant it, which is a
    // different thing. A license here is a public, machine-readable grant
    // of reuse rights, and asserting one the site owner has never agreed
    // to is not a metadata detail.
    //
    // When a licence is chosen deliberately and stated on the site, this
    // is where it goes.
    isAccessibleForFree: true,
    creativeWorkStatus: "Published",
    inLanguage: "en",
    creator: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    // The reference window every published score is ranked against.
    // Written as an ISO 8601 interval, which is the form Dataset Search
    // expects. REFERENCE_SPAN renders as "2000–2025" for readers.
    temporalCoverage: REFERENCE_SPAN.replace(/[–—]/, "/"),
    spatialCoverage: FALLBACK_MARKETS.map((m) => ({ "@type": "Place", name: m.name })),
    variableMeasured: [
      { "@type": "PropertyValue", name: "Inflation", description: "Year-over-year consumer price inflation, on the measure each central bank targets", unitText: "PERCENT" },
      { "@type": "PropertyValue", name: "GDP growth", description: "Quarterly real GDP growth against the same quarter a year earlier", unitText: "PERCENT" },
      { "@type": "PropertyValue", name: "Unemployment", description: "Harmonised labour force survey unemployment rate, seasonally adjusted", unitText: "PERCENT" },
      { "@type": "PropertyValue", name: "Policy rate", description: "The central bank's own policy interest rate", unitText: "PERCENT" },
      { "@type": "PropertyValue", name: "Government debt", description: "Credit to general government as a share of GDP", unitText: "PERCENT" },
    ],
  };
}

/** One JSON-LD graph. See the two modes below. */
export default function StructuredData({ dataset: datasetOnly = false }: { dataset?: boolean }) {
  // TWO MODES, AND THE SPLIT IS THE POINT.
  //
  // The root layout renders the default: who publishes this site and what
  // the site is, on every page, because those are true everywhere.
  //
  // The HOMEPAGE additionally renders the dataset node on its own. The
  // index is ONE dataset, described once, at its canonical address —
  // emitting it from the layout would attach it to all eleven pages and
  // claim eleven datasets exist. It refers to the publisher by @id rather
  // than repeating it, which is what @id is for.
  const graph = datasetOnly ? [dataset()] : [organisation(), website()];

  return (
    <script
      type="application/ld+json"
      // The content is built from constants in this repository, not from
      // anything a reader can supply, so there is no injection surface --
      // but the angle brackets are escaped anyway, because a market name
      // containing one would otherwise break out of the script tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c"),
      }}
    />
  );
}
