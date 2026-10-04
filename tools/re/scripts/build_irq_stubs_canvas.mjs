import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const data = JSON.parse(
  fs.readFileSync(new URL("../out/irq_stubs_review.json", import.meta.url), "utf8"),
);

function bytesFromHex(hex) {
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(hex.slice(i, i + 2).toUpperCase());
  return out;
}

const bounds = data.codeBounds || {};
const endIncHex = "0x" + (bounds.endInclusive ?? 0xb930).toString(16).toUpperCase();
const endExHex = "0x" + (bounds.endExclusive ?? 0xb931).toString(16).toUpperCase();
const codeStartHex = "0x" + (bounds.start ?? 0x2000).toString(16).toUpperCase();
const dataStartHex = "0x" + (bounds.dataStart ?? 0xb931).toString(16).toUpperCase();

const pack = {
  meta: {
    siteCount: data.siteCount,
    sitesInsideCode: data.sitesInsideCodeToB930 ?? data.siteCount,
    axxxLandingCount: data.axxxLandingCount,
    isa: data.isa,
    ghidraLanguage: data.ghidraLanguage,
    rom: data.rom,
    codeStartHex,
    codeEndInclusiveHex: endIncHex,
    codeEndExclusiveHex: endExHex,
    dataStartHex,
    codeBoundsNote: bounds.note || "CODE ends at 0xB930 inclusive (Richard).",
    addressingNote: data.addressingNote,
    shippingNote: data.shippingNote,
  },
  sites: data.sites.map((s) => {
    const stubLen = s.stubBytes.hex.length / 2;
    const inside = !!s.landing.insideBaselineCode;
    return {
      id: s.id,
      vectorIndex: s.vectorIndex,
      vectorAddrHex: s.vectorAddrHex,
      stubAddrHex: s.stubAddrHex,
      stubPrologue: s.stubPrologue,
      ljmpAddrHex: s.addrHex || s.cfg_edge_from.fromHex,
      ghidraAtStub: s.ghidra_insn_at_stub,
      ghidraLjmp: s.ghidra_insn,
      stubRegion: s.region_label,
      landingAddrHex: s.landing.addrHex,
      landingRegion: s.landing.region_label,
      inHighAxxx: !!s.landing.inHighAxxx,
      insideBaselineCode: inside,
      dispHex: s.cfg_edge_from.dispHex,
      edgeStatus: s.cfg_edge_from.verificationStatus,
      stubHexBytes: bytesFromHex(s.bytes.hex),
      stubFocusStart: s.bytes.focusOffset,
      stubFocusEnd: s.bytes.focusOffset + stubLen,
      stubWindowStartHex: "0x" + s.bytes.start.toString(16).toUpperCase(),
      landingHexBytes: bytesFromHex(s.landing.bytes.hex),
      landingWindowStartHex: "0x" + s.landing.bytes.start.toString(16).toUpperCase(),
      landingNearby: (s.landing.ghidra_insns_nearby || []).map((x) => x.addrHex + " " + x.insn),
      explanation: s.explanation,
      decision: inside
        ? "Inside CODE 0x2000–0xB930 inclusive. Decide: real IRQ handler vs mid-CODE data island. Do not ship yet."
        : "Landing beyond CODE endInclusive 0xB930 (DATA from 0xB931) — unexpected under current baseline.",
    };
  }),
};

const dataLit = JSON.stringify(pack, null, 2);

const canvas = `import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Code,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useHostTheme,
  useState,
} from "cursor/canvas";

const REVIEW = ${dataLit} as const;

type Site = (typeof REVIEW.sites)[number];

function HexRow({
  bytes,
  focusStart,
  focusEnd,
  tone,
}: {
  bytes: readonly string[];
  focusStart: number;
  focusEnd: number;
  tone: "stub" | "landing";
}) {
  const theme = useHostTheme();
  const focusBg = tone === "stub" ? theme.fill.secondary : theme.fill.tertiary;
  return (
    <Row gap={4} wrap style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12 }}>
      {bytes.map((b, i) => {
        const on = i >= focusStart && i < focusEnd;
        return (
          <span
            key={i}
            style={{
              padding: "2px 4px",
              color: on ? theme.text.primary : theme.text.tertiary,
              background: on ? focusBg : "transparent",
            }}
          >
            {b}
          </span>
        );
      })}
    </Row>
  );
}

function SiteCard({
  site,
  open,
  onOpenChange,
}: {
  site: Site;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const theme = useHostTheme();
  return (
    <Card collapsible open={open} onOpenChange={onOpenChange}>
      <CardHeader
        trailing={
          <Text size="small" tone="secondary">
            {site.stubAddrHex} → {site.landingAddrHex}
          </Text>
        }
      >
        {site.id + " · vec[" + String(site.vectorIndex) + "]"}
      </CardHeader>
      <CardBody>
        <Stack gap={10}>
          <Row gap={8} wrap>
            <Pill active size="sm">
              {site.stubPrologue}
            </Pill>
            <Pill size="sm">{site.ghidraLjmp}</Pill>
            <Pill size="sm" active>
              {site.insideBaselineCode ? "CODE ≤0xB930 incl." : "beyond CODE"}
            </Pill>
          </Row>
          <Grid columns={2} gap={12}>
            <Stack gap={4}>
              <Text size="small" tone="tertiary">
                Stub window @ {site.stubWindowStartHex} (highlight = prologue+LJMP)
              </Text>
              <div style={{ padding: 8, background: theme.fill.quaternary }}>
                <HexRow
                  bytes={site.stubHexBytes}
                  focusStart={site.stubFocusStart}
                  focusEnd={site.stubFocusEnd}
                  tone="stub"
                />
              </div>
            </Stack>
            <Stack gap={4}>
              <Text size="small" tone="tertiary">
                Landing window @ {site.landingWindowStartHex} (first 8 bytes)
              </Text>
              <div style={{ padding: 8, background: theme.fill.quaternary }}>
                <HexRow
                  bytes={site.landingHexBytes}
                  focusStart={0}
                  focusEnd={8}
                  tone="landing"
                />
              </div>
            </Stack>
          </Grid>
          <Text size="small" tone="secondary">
            CFG edge {site.ljmpAddrHex} {site.ghidraLjmp} disp {site.dispHex} · status{" "}
            {site.edgeStatus} · landing {site.landingRegion}
          </Text>
          {site.landingNearby.length > 0 ? (
            <Stack gap={4}>
              <Text size="small" weight="semibold">
                Ghidra at landing
              </Text>
              {site.landingNearby.map((line) => (
                <Text key={line} size="small" tone="secondary">
                  <Code>{line}</Code>
                </Text>
              ))}
            </Stack>
          ) : (
            <Text size="small" tone="tertiary">
              No Ghidra instructions listed at landing.
            </Text>
          )}
          <Divider />
          <Text>{site.explanation}</Text>
          <Callout tone="info" title="What to decide">
            {site.decision}
          </Callout>
        </Stack>
      </CardBody>
    </Card>
  );
}

export default function IrqStubsReview() {
  const theme = useHostTheme();
  const [filter, setFilter] = useState<"all" | "axxx" | "low">("all");
  const [openId, setOpenId] = useState<string | null>(REVIEW.sites[0]?.id ?? null);

  const sites = REVIEW.sites.filter((s) => {
    if (filter === "axxx") return s.inHighAxxx;
    if (filter === "low") return !s.inHighAxxx;
    return true;
  });

  return (
    <Stack gap={20} style={{ padding: 20, background: theme.bg.editor }}>
      <Stack gap={8}>
        <H1>IRQ stubs review</H1>
        <Text tone="secondary">
          RedLabel MCS-96 — CODE {REVIEW.meta.codeStartHex}–{REVIEW.meta.codeEndInclusiveHex}{" "}
          inclusive (endExclusive {REVIEW.meta.codeEndExclusiveHex}; DATA from{" "}
          {REVIEW.meta.dataStartHex}). Source: tools/re/out/irq_stubs_review.json · {REVIEW.meta.rom}
        </Text>
      </Stack>

      <Callout tone="info" title={"CODE " + REVIEW.meta.codeStartHex + "–" + REVIEW.meta.codeEndInclusiveHex + " inclusive"}>
        {REVIEW.meta.codeBoundsNote} {REVIEW.meta.shippingNote} {REVIEW.meta.addressingNote}
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value={String(REVIEW.meta.siteCount)} label="IRQ stub sites" />
        <Stat
          value={String(REVIEW.meta.sitesInsideCode)}
          label="Inside CODE to 0xB930"
          tone="success"
        />
        <Stat
          value={String(REVIEW.meta.axxxLandingCount)}
          label="0xAxxx landings"
          tone="info"
        />
        <Stat
          value={REVIEW.meta.codeEndInclusiveHex + " incl."}
          label={"endExclusive " + REVIEW.meta.codeEndExclusiveHex}
        />
      </Grid>

      <Stack gap={8}>
        <H2>Filter</H2>
        <Row gap={8} wrap>
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>
            All 8
          </Pill>
          <Pill active={filter === "axxx"} onClick={() => setFilter("axxx")}>
            0xAxxx (7)
          </Pill>
          <Pill active={filter === "low"} onClick={() => setFilter("low")}>
            Low CODE (1)
          </Pill>
        </Row>
      </Stack>

      <Stack gap={8}>
        <H2>Index</H2>
        <Table
          headers={["Vec", "Stub", "Prologue", "Ghidra", "Landing", "Baseline"]}
          columnAlign={["left", "left", "left", "left", "left", "left"]}
          rowTone={sites.map(() => "success")}
          rows={sites.map((s) => [
            String(s.vectorIndex),
            s.stubAddrHex,
            s.stubPrologue,
            s.ghidraLjmp,
            s.landingAddrHex,
            s.insideBaselineCode ? "CODE ≤0xB930 incl." : "beyond",
          ])}
        />
        <Text size="small" tone="tertiary">
          Cloud RE v2 · CODE 0x2000–0xB930 inclusive · PR cursor/redlabel-ghidra-re-48cf · CFG
          cross_checked
        </Text>
      </Stack>

      <Stack gap={12}>
        <H2>Sites</H2>
        <Text tone="secondary">
          Expand a site for hex context, Ghidra at landing, and the remaining mid-CODE
          executable-vs-data decision. 0xAxxx is inside CODE under this baseline.
        </Text>
        {sites.map((site) => (
          <SiteCard
            key={site.id}
            site={site}
            open={openId === site.id}
            onOpenChange={(next) => setOpenId(next ? site.id : null)}
          />
        ))}
      </Stack>

      <Stack gap={8}>
        <H3>Decision rubric</H3>
        <Text>
          CODE is 0x2000–0xB930 inclusive (endExclusive 0xB931; DATA from 0xB931). All eight IRQ
          landings are inside that window. Remaining review: real IRQ handler vs mid-CODE data
          island. Never promote into definitions/packs/*.shipping.json from this review alone.
        </Text>
      </Stack>
    </Stack>
  );
}
`;

const out = path.join(
  os.homedir(),
  ".cursor",
  "projects",
  "c-Users-user-Projects-BROtronic",
  "canvases",
  "irq-stubs-review.canvas.tsx",
);
fs.writeFileSync(out, canvas);
console.log("wrote", out, canvas.length);
