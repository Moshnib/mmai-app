import { parseRss, parseAtom } from "@/lib/fetchers/newsFeeds";

const rss2 =
  "<rss><channel><item><title>Hello</title><link>https://example.com/a</link>" +
  "<pubDate>Tue, 16 Sep 2026 18:00:00 GMT</pubDate></item></channel></rss>";

const rdf =
  '<rdf:RDF><item rdf:about="x"><title>RDF item</title><link>https://example.com/b</link>' +
  "<dc:date>2026-09-15T10:00:00Z</dc:date></item></rdf:RDF>";

const atom =
  '<feed><entry><title>Atom item</title><link rel="alternate" href="https://example.com/c"/>' +
  "<updated>2026-09-15T10:00:00Z</updated></entry></feed>";

console.log("rss 2.0 :", JSON.stringify(parseRss(rss2)));
console.log("rss 1.0 :", JSON.stringify(parseRss(rdf)));
console.log("atom    :", JSON.stringify(parseAtom(atom)));
