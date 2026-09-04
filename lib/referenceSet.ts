// ============================================================
//  THE MMAI REFERENCE SET — 148 market-years, six economies, 2000-2025.
//
//  GENERATED FROM THE PUBLISHED CSV. Do not hand-edit. The file this was
//  built from is the same file readers are given to check our arithmetic:
//
//    MMAI_reference_set_148.csv
//    SHA-256 ca37d6edf9174d211b4669c86ef0f3a437048d66e2da1694dad6cd88a423b256
//
//  Every constant in the scoring engine is computed from these rows and
//  nothing else, and scripts/verify-composite.ts fails the build if any
//  of them drifts from the documented value.
//
//  JAPAN CARRIES 18 ROWS, NOT 26. 2001-2005 and 2013-2015 are absent
//  because the Bank of Japan targeted the monetary base rather than a
//  rate in those years, so no policy rate exists to record. Verified
//  absent at source, not dropped for convenience -- which is why the
//  pooled distribution is a market-year distribution with unequal
//  country representation, and is described that way.
//
//  SOURCES CHANGE AT 2019. Rows to 2018 take inflation, growth and
//  unemployment from the World Bank annual series and the policy rate
//  from BIS; 2019 onward take all four from the national statistical
//  agencies and central banks the live site uses. Government debt is BIS
//  throughout. The effect of that break was measured at up to 2.3
//  percentile points, with the ranking unaffected.
// ============================================================

export interface ReferenceRow {
  /** Market code. */
  m: string;
  /** Calendar year. */
  y: number;
  /** |inflation - target|, percentage points. */
  infGap: number;
  /** Headline unemployment rate, %. */
  une: number;
  /** Real GDP growth, year on year, %. */
  gdp: number;
  /** Credit to general government, all sectors, market value, % of GDP. */
  debt: number;
  /** Headline policy rate, %. */
  rate: number;
}

/** The published SHA-256 of the CSV these rows were generated from. */
export const REFERENCE_SET_SHA256 =
  "ca37d6edf9174d211b4669c86ef0f3a437048d66e2da1694dad6cd88a423b256";

export const REFERENCE_SET: readonly ReferenceRow[] = [
  { m: "AU", y: 2000, infGap: 1.95743705920869, une: 6.288, gdp: 3.9160574881715, debt: 16.8, rate: 6.25 },
  { m: "AU", y: 2001, infGap: 1.90712998561533, une: 6.747, gdp: 2.03145880248898, debt: 15.2, rate: 4.25 },
  { m: "AU", y: 2002, infGap: 0.4815711704745702, une: 6.375, gdp: 3.94980535772942, debt: 13.4, rate: 4.75 },
  { m: "AU", y: 2003, infGap: 0.23259754838937008, une: 5.933, gdp: 3.0912800997751, debt: 11.7, rate: 5.25 },
  { m: "AU", y: 2004, infGap: 0.15674312868735019, une: 5.399, gdp: 4.21894147547516, debt: 10.7, rate: 5.25 },
  { m: "AU", y: 2005, infGap: 0.19182949622197, une: 5.036, gdp: 3.15548121323168, debt: 9.7, rate: 5.5 },
  { m: "AU", y: 2006, infGap: 1.0552869697298402, une: 4.785, gdp: 2.7709261737475, debt: 8.8, rate: 6.25 },
  { m: "AU", y: 2007, infGap: 0.1723855737684099, une: 4.381, gdp: 3.78947119882653, debt: 9, rate: 6.75 },
  { m: "AU", y: 2008, infGap: 1.85029726664093, une: 4.242, gdp: 3.62398503565633, debt: 9.6, rate: 4.25 },
  { m: "AU", y: 2009, infGap: 0.72887974318344, une: 5.565, gdp: 1.95484826298522, debt: 15.1, rate: 3.75 },
  { m: "AU", y: 2010, infGap: 0.41833702112220017, une: 5.214, gdp: 2.21004795300735, debt: 19.1, rate: 4.75 },
  { m: "AU", y: 2011, infGap: 0.8038478468108101, une: 5.083, gdp: 2.39473494330615, debt: 22.9, rate: 4.25 },
  { m: "AU", y: 2012, infGap: 0.73721700947772, une: 5.225, gdp: 3.95247138119184, debt: 26.1, rate: 3 },
  { m: "AU", y: 2013, infGap: 0.05011751890741012, une: 5.663, gdp: 2.65445302592404, debt: 28.4, rate: 2.5 },
  { m: "AU", y: 2014, infGap: 0.012070679195080203, une: 6.078, gdp: 2.60118978187332, debt: 31.4, rate: 2.5 },
  { m: "AU", y: 2015, infGap: 0.9916319686153701, une: 6.055, gdp: 2.16434780647852, debt: 34.2, rate: 2 },
  { m: "AU", y: 2016, infGap: 1.22300634279694, une: 5.711, gdp: 2.75564065529868, debt: 36.7, rate: 1.5 },
  { m: "AU", y: 2017, infGap: 0.55135690934347, une: 5.592, gdp: 2.29331030192918, debt: 37.8, rate: 1.5 },
  { m: "AU", y: 2018, infGap: 0.5885999718142101, une: 5.345, gdp: 2.87417039499501, debt: 37.5, rate: 1.5 },
  { m: "AU", y: 2019, infGap: 0.8999999999999999, une: 5.2, gdp: 1.9, debt: 38, rate: 0.75 },
  { m: "AU", y: 2020, infGap: 1.6, une: 6.5, gdp: -2.4, debt: 55.4, rate: 0.1 },
  { m: "AU", y: 2021, infGap: 0.3999999999999999, une: 5.1, gdp: 4.6, debt: 53.6, rate: 0.1 },
  { m: "AU", y: 2022, infGap: 4.09, une: 3.73, gdp: 3.8, debt: 50.5, rate: 3.05 },
  { m: "AU", y: 2023, infGap: 3.0999999999999996, une: 3.67, gdp: 2.06, debt: 50.1, rate: 4.35 },
  { m: "AU", y: 2024, infGap: 0.6699999999999999, une: 4.07, gdp: 1.04, debt: 50.6, rate: 4.35 },
  { m: "AU", y: 2025, infGap: 1.1, une: 4.5, gdp: 2, debt: 52.1, rate: 3.6 },
  { m: "CA", y: 2000, infGap: 0.7194399569197598, une: 6.829, gdp: 5.13853918994158, debt: 75.9, rate: 5.75 },
  { m: "CA", y: 2001, infGap: 0.5251201397990601, une: 7.219, gdp: 1.87509813099847, debt: 74.2, rate: 2.25 },
  { m: "CA", y: 2002, infGap: 0.2583944094085502, une: 7.665, gdp: 2.99925533832644, debt: 73, rate: 2.75 },
  { m: "CA", y: 2003, infGap: 0.75856321360112, une: 7.574, gdp: 1.8063851195103, debt: 69.2, rate: 2.75 },
  { m: "CA", y: 2004, infGap: 0.14274128142744003, une: 7.185, gdp: 3.09236381038156, debt: 65.2, rate: 2.5 },
  { m: "CA", y: 2005, infGap: 0.21355203439767, une: 6.758, gdp: 3.21045441502793, debt: 61.9, rate: 3.25 },
  { m: "CA", y: 2006, infGap: 0.002025395341609837, une: 6.484, gdp: 2.63794375302722, debt: 59.9, rate: 4.25 },
  { m: "CA", y: 2007, infGap: 0.13838399266836987, une: 6.156, gdp: 2.04990459443619, debt: 56.5, rate: 4.25 },
  { m: "CA", y: 2008, infGap: 0.37027067444299, une: 6.284, gdp: 0.995406371264522, debt: 61.1, rate: 1.5 },
  { m: "CA", y: 2009, infGap: 1.700533196990701, une: 8.46, gdp: -2.91508627059555, debt: 73.5, rate: 0.25 },
  { m: "CA", y: 2010, infGap: 0.2231284590737299, une: 8.178, gdp: 3.09080633744851, debt: 74.7, rate: 1 },
  { m: "CA", y: 2011, infGap: 0.91213508872351, une: 7.637, gdp: 3.1371944343876, debt: 75.4, rate: 1 },
  { m: "CA", y: 2012, infGap: 0.48432176875483, une: 7.392, gdp: 1.75566133205234, debt: 78, rate: 1 },
  { m: "CA", y: 2013, infGap: 1.061708102184683, une: 7.143, gdp: 2.32581356612762, debt: 79.4, rate: 1 },
  { m: "CA", y: 2014, infGap: 0.09336409282138991, une: 7.023, gdp: 2.87346675579731, debt: 77, rate: 1 },
  { m: "CA", y: 2015, infGap: 0.87475863905723, une: 6.945, gdp: 0.64997101491096, debt: 82.4, rate: 0.5 },
  { m: "CA", y: 2016, infGap: 0.5712404529891499, une: 7.038, gdp: 1.03855091989323, debt: 82.8, rate: 0.5 },
  { m: "CA", y: 2017, infGap: 0.4031158714702301, une: 6.426, gdp: 3.03383491841392, debt: 81.5, rate: 1 },
  { m: "CA", y: 2018, infGap: 0.26822567248103013, une: 5.837, gdp: 2.74296341402246, debt: 81.2, rate: 1.75 },
  { m: "CA", y: 2019, infGap: 0.10000000000000009, une: 5.7, gdp: 1.9, debt: 81.4, rate: 1.75 },
  { m: "CA", y: 2020, infGap: 1.3, une: 9.6, gdp: -5, debt: 106.1, rate: 0.25 },
  { m: "CA", y: 2021, infGap: 1.4, une: 7.5, gdp: 5, debt: 100.7, rate: 0.25 },
  { m: "CA", y: 2022, infGap: 4.8, une: 5.3, gdp: 3.8, debt: 91.9, rate: 2.5 },
  { m: "CA", y: 2023, infGap: 1.9, une: 5.4, gdp: 1.2, debt: 92.9, rate: 5 },
  { m: "CA", y: 2024, infGap: 0.3999999999999999, une: 6.4, gdp: 1.3, debt: 97, rate: 4 },
  { m: "CA", y: 2025, infGap: 0, une: 6.6, gdp: 1, debt: 100.2, rate: 2.75 },
  { m: "EA", y: 2000, infGap: 1.04210080667792, une: 9.62410987839098, gdp: 3.90347314568078, debt: 69.2, rate: 4.75 },
  { m: "EA", y: 2001, infGap: 0.9294924432410401, une: 8.68043359773922, gdp: 2.19003494343926, debt: 68.2, rate: 3.25 },
  { m: "EA", y: 2002, infGap: 0.4653231917116498, une: 8.88672719145059, gdp: 0.961839553423374, debt: 68.1, rate: 2.75 },
  { m: "EA", y: 2003, infGap: 0.09847219146918995, une: 9.12146121246139, gdp: 0.767586747443971, debt: 69.4, rate: 2 },
  { m: "EA", y: 2004, infGap: 0.2256791642889402, une: 9.348951357228, gdp: 2.32594393008132, debt: 69.8, rate: 2 },
  { m: "EA", y: 2005, infGap: 0.5601613233023501, une: 9.16921983218386, gdp: 1.79011534612007, debt: 70.4, rate: 2.25 },
  { m: "EA", y: 2006, infGap: 0.7737800648147202, une: 8.4404790481661, gdp: 3.33733486627055, debt: 68.3, rate: 3.5 },
  { m: "EA", y: 2007, infGap: 0.5106656524034001, une: 7.52316793797376, gdp: 3.02499371345013, debt: 65.9, rate: 4 },
  { m: "EA", y: 2008, infGap: 2.15279708110293, une: 7.50283392231425, gdp: 0.432969401075084, debt: 69.6, rate: 2.5 },
  { m: "EA", y: 2009, infGap: 1.493691172303496, une: 9.57439638727687, gdp: -4.47805035961746, debt: 80, rate: 1 },
  { m: "EA", y: 2010, infGap: 0.4744839788175199, une: 10.1761738210052, gdp: 2.1158694775215, debt: 85.5, rate: 1 },
  { m: "EA", y: 2011, infGap: 1.2894493956420998, une: 10.2805136631252, gdp: 1.77884441456963, debt: 87.3, rate: 1 },
  { m: "EA", y: 2012, infGap: 0.5974138603900299, une: 11.4328240980269, gdp: -0.913859085753131, debt: 90.8, rate: 0.75 },
  { m: "EA", y: 2013, infGap: 0.78000657725694, une: 12.0184063277941, gdp: -0.168322337087545, debt: 92.7, rate: 0.25 },
  { m: "EA", y: 2014, infGap: 1.800656173429156, une: 11.6207304139349, gdp: 1.45371535311074, debt: 92.9, rate: 0.05 },
  { m: "EA", y: 2015, infGap: 2.104633261008479, une: 10.8477448563899, gdp: 2.14894477032594, debt: 91, rate: 0.05 },
  { m: "EA", y: 2016, infGap: 1.851315092372627, une: 9.98608545604403, gdp: 1.80681433573471, debt: 90, rate: 0 },
  { m: "EA", y: 2017, infGap: 0.6185412859278401, une: 9.01311660134066, gdp: 2.62315671239708, debt: 87.4, rate: 0 },
  { m: "EA", y: 2018, infGap: 0.29650205255521, une: 8.089323082041, gdp: 1.78229304985051, debt: 85.5, rate: 0 },
  { m: "EA", y: 2019, infGap: 0.8, une: 7.6, gdp: 1.6, debt: 83.5, rate: -0.4 },
  { m: "EA", y: 2020, infGap: 1.7, une: 7.9, gdp: -6.1, debt: 96.6, rate: -0.5 },
  { m: "EA", y: 2021, infGap: 0.6000000000000001, une: 7.7, gdp: 5.9, debt: 93.9, rate: -0.5 },
  { m: "EA", y: 2022, infGap: 6.4, une: 6.7, gdp: 3.5, debt: 89.4, rate: 0.8 },
  { m: "EA", y: 2023, infGap: 3.4000000000000004, une: 6.5, gdp: 0.4, debt: 86.9, rate: 3.9 },
  { m: "EA", y: 2024, infGap: 0.3999999999999999, une: 6.4, gdp: 0.8, debt: 87.1, rate: 3.5 },
  { m: "EA", y: 2025, infGap: 0.10000000000000009, une: 6.2, gdp: 1.4, debt: 87.9, rate: 2 },
  { m: "JP", y: 2000, infGap: 2.6765786835951753, une: 4.748, gdp: 2.97832688768516, debt: 113, rate: 0.25 },
  { m: "JP", y: 2006, infGap: 1.750644883920915, une: 4.192, gdp: 1.54630843078741, debt: 142.7, rate: 0.25 },
  { m: "JP", y: 2007, infGap: 1.939960545501331, une: 3.888, gdp: 1.72837912865577, debt: 140.8, rate: 0.5 },
  { m: "JP", y: 2008, infGap: 0.6199211383508001, une: 4.002, gdp: -1.16662209355141, debt: 143.6, rate: 0.1 },
  { m: "JP", y: 2009, infGap: 3.3528367295171897, une: 5.068, gdp: -5.9359411383964, debt: 162.9, rate: 0.1 },
  { m: "JP", y: 2010, infGap: 2.728243207517779, une: 5.102, gdp: 4.13645589222239, debt: 169.3, rate: 0.05 },
  { m: "JP", y: 2011, infGap: 2.27245561610124, une: 4.55, gdp: -0.20035785332982, debt: 181.7, rate: 0.05 },
  { m: "JP", y: 2012, infGap: 2.04406451044326, une: 4.358, gdp: 1.64893452981225, debt: 188.1, rate: 0.05 },
  { m: "JP", y: 2016, infGap: 2.127258844489754, une: 3.132, gdp: 0.704986495111257, debt: 194.4, rate: -0.1 },
  { m: "JP", y: 2017, infGap: 1.515800203873615, une: 2.822, gdp: 1.62345062245441, debt: 195.1, rate: -0.1 },
  { m: "JP", y: 2018, infGap: 1.010905401978152, une: 2.467, gdp: 0.834143845965585, debt: 196.2, rate: -0.1 },
  { m: "JP", y: 2019, infGap: 1.5, une: 2.4, gdp: -0.4, debt: 198.5, rate: -0.1 },
  { m: "JP", y: 2020, infGap: 2, une: 2.8, gdp: -4.1, debt: 220.5, rate: -0.1 },
  { m: "JP", y: 2021, infGap: 2.2, une: 2.8, gdp: 2.6, debt: 212.9, rate: -0.1 },
  { m: "JP", y: 2022, infGap: 0.5, une: 2.6, gdp: 0.9, debt: 217.5, rate: -0.1 },
  { m: "JP", y: 2023, infGap: 1.27, une: 2.6, gdp: 1.9, debt: 210.5, rate: -0.1 },
  { m: "JP", y: 2024, infGap: 0.7400000000000002, une: 2.5, gdp: 0.2, debt: 203.7, rate: 0.25 },
  { m: "JP", y: 2025, infGap: 0.8999999999999999, une: 2.4, gdp: 0.9, debt: 194.5, rate: 0.75 },
  { m: "UK", y: 2000, infGap: 0.81704375789592, une: 5.558, gdp: 4.52438074810904, debt: 37.5, rate: 6 },
  { m: "UK", y: 2001, infGap: 0.4676503972758199, une: 4.696, gdp: 2.39102229602824, debt: 34.8, rate: 4 },
  { m: "UK", y: 2002, infGap: 0.47959754052545, une: 5.037, gdp: 1.70902736258567, debt: 35.3, rate: 4 },
  { m: "UK", y: 2003, infGap: 0.6234996145798699, une: 4.807, gdp: 3.21851612669614, debt: 36.6, rate: 3.75 },
  { m: "UK", y: 2004, infGap: 0.6096024331957799, une: 4.594, gdp: 2.32601853325993, debt: 39.7, rate: 4.75 },
  { m: "UK", y: 2005, infGap: 0.08913649025069992, une: 4.884, gdp: 2.7906547174688, debt: 40.9, rate: 4.5 },
  { m: "UK", y: 2006, infGap: 0.4556616643928999, une: 5.472, gdp: 2.18982132415704, debt: 41.9, rate: 5 },
  { m: "UK", y: 2007, infGap: 0.38656150773327, une: 5.399, gdp: 2.93091133582351, debt: 43, rate: 5.5 },
  { m: "UK", y: 2008, infGap: 1.52140856342539, une: 5.748, gdp: -0.0494116727402769, debt: 50.6, rate: 2 },
  { m: "UK", y: 2009, infGap: 0.03826826439891007, une: 7.683, gdp: -4.58740819226323, debt: 64.5, rate: 0.5 },
  { m: "UK", y: 2010, infGap: 0.4926547246706501, une: 7.973, gdp: 2.26054460931586, debt: 75.5, rate: 0.5 },
  { m: "UK", y: 2011, infGap: 1.8561124468282002, une: 8.195, gdp: 0.851437739020326, debt: 81.1, rate: 0.5 },
  { m: "UK", y: 2012, infGap: 0.5732347965453002, une: 8.279, gdp: 1.52826034721852, debt: 84.1, rate: 0.5 },
  { m: "UK", y: 2013, infGap: 0.29166666666659014, une: 7.752, gdp: 1.71846961308464, debt: 84.9, rate: 0.5 },
  { m: "UK", y: 2014, infGap: 0.5488798370672101, une: 6.398, gdp: 3.16017351468152, debt: 86.5, rate: 0.5 },
  { m: "UK", y: 2015, infGap: 1.63195315767464, une: 5.552, gdp: 2.14040560033371, debt: 87.3, rate: 0.5 },
  { m: "UK", y: 2016, infGap: 0.9915826318859, une: 4.909, gdp: 2.20652020635357, debt: 87.3, rate: 0.25 },
  { m: "UK", y: 2017, infGap: 0.55775577557747, une: 4.501, gdp: 3.02322219840339, debt: 86.1, rate: 0.5 },
  { m: "UK", y: 2018, infGap: 0.29283990345938005, une: 4.145, gdp: 1.55133095078786, debt: 85.6, rate: 0.75 },
  { m: "UK", y: 2019, infGap: 0.19999999999999996, une: 3.9, gdp: 1.4, debt: 84.9, rate: 0.75 },
  { m: "UK", y: 2020, infGap: 1.1, une: 4.5, gdp: -10.4, debt: 104.8, rate: 0.1 },
  { m: "UK", y: 2021, infGap: 0.6000000000000001, une: 4.5, gdp: 8.6, debt: 103.4, rate: 0.25 },
  { m: "UK", y: 2022, infGap: 7.1, une: 3.7, gdp: 4.1, debt: 97.5, rate: 3.5 },
  { m: "UK", y: 2023, infGap: 5.3, une: 4, gdp: 0.3, debt: 98.8, rate: 5.25 },
  { m: "UK", y: 2024, infGap: 0.5, une: 4.4, gdp: 1.1, debt: 99.7, rate: 4.75 },
  { m: "UK", y: 2025, infGap: 1.4, une: 4.8, gdp: 0.7, debt: 102.2, rate: 3.75 },
  { m: "US", y: 2000, infGap: 1.37685727149929, une: 3.992, gdp: 4.07758575997799, debt: 48.7, rate: 6.5 },
  { m: "US", y: 2001, infGap: 0.8261711188540701, une: 4.731, gdp: 0.955538337599847, debt: 48.5, rate: 1.75 },
  { m: "US", y: 2002, infGap: 0.41396837349399007, une: 5.783, gdp: 1.70044733078285, debt: 50.6, rate: 1.25 },
  { m: "US", y: 2003, infGap: 0.2700949733611502, une: 5.989, gdp: 2.79560596378604, debt: 52.7, rate: 1 },
  { m: "US", y: 2004, infGap: 0.6772366930917202, une: 5.529, gdp: 3.84777169267127, debt: 60.1, rate: 2.25 },
  { m: "US", y: 2005, infGap: 1.3927468454955, une: 5.084, gdp: 3.48354993710312, debt: 59.1, rate: 4.25 },
  { m: "US", y: 2006, infGap: 1.22594410070404, une: 4.623, gdp: 2.78453963674239, debt: 57.8, rate: 5.25 },
  { m: "US", y: 2007, infGap: 0.8526724815013802, une: 4.622, gdp: 2.0038583039496, debt: 57.6, rate: 4.25 },
  { m: "US", y: 2008, infGap: 1.839100296651, une: 5.784, gdp: 0.113587247501258, debt: 66.1, rate: 0.125 },
  { m: "US", y: 2009, infGap: 2.355546266299747, une: 9.254, gdp: -2.5765002366652, debt: 78.6, rate: 0.125 },
  { m: "US", y: 2010, infGap: 0.35995655761010004, une: 9.633, gdp: 2.69519258673525, debt: 87, rate: 0.125 },
  { m: "US", y: 2011, infGap: 1.1568415686220002, une: 8.949, gdp: 1.56440685205419, debt: 91.2, rate: 0.125 },
  { m: "US", y: 2012, infGap: 0.06933726526066986, une: 8.069, gdp: 2.28911339009767, debt: 94.7, rate: 0.125 },
  { m: "US", y: 2013, infGap: 0.53516734437283, une: 7.375, gdp: 2.11783009443471, debt: 95.9, rate: 0.125 },
  { m: "US", y: 2014, infGap: 0.37777702259183, une: 6.168, gdp: 2.52381981757846, debt: 96, rate: 0.125 },
  { m: "US", y: 2015, infGap: 1.881372864447549, une: 5.28, gdp: 2.94555045227337, debt: 96.8, rate: 0.375 },
  { m: "US", y: 2016, infGap: 0.73841679429464, une: 4.869, gdp: 1.81945147909089, debt: 98.6, rate: 0.625 },
  { m: "US", y: 2017, infGap: 0.13011000365961012, une: 4.355, gdp: 2.45762230126449, debt: 97.4, rate: 1.375 },
  { m: "US", y: 2018, infGap: 0.44258329692817, une: 3.896, gdp: 2.96650506701943, debt: 98.5, rate: 2.375 },
  { m: "US", y: 2019, infGap: 0.19999999999999996, une: 3.7, gdp: 2.3, debt: 99.7, rate: 2.4 },
  { m: "US", y: 2020, infGap: 0.8, une: 8.1, gdp: -2.8, debt: 121, rate: 0.4 },
  { m: "US", y: 2021, infGap: 2.7, une: 5.4, gdp: 5.9, debt: 114.7, rate: 0.1 },
  { m: "US", y: 2022, infGap: 6, une: 3.6, gdp: 2.1, debt: 110.1, rate: 1.7 },
  { m: "US", y: 2023, infGap: 2.0999999999999996, une: 3.6, gdp: 2.5, debt: 112.3, rate: 5 },
  { m: "US", y: 2024, infGap: 1, une: 4, gdp: 2.8, debt: 114, rate: 5.3 },
  { m: "US", y: 2025, infGap: 0.7999999999999998, une: 4.5, gdp: 1.7, debt: 116.4, rate: 3.75 },
];
