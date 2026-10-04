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

const staleCount = data.sites.filter((s) => s.landing.coarseMapConflict).length;
const axxxCount = data.sites.filter((s) => s.landing.inHighAxxx).length;
const codeEnd = data.codeWindow?.endExclusiveHex || "0xB930";

const pack = {
  meta: {
    siteCount: data.siteCount,
    axxxLandingCount: data.axxxLandingCount ?? axxxCount,
    baselineCodeLandingCount: data.baselineCodeLandingCount ?? data.siteCount,
    staleCoarseDataCount: staleCount,
    isa: data.isa,
    ghidraLanguage: data.ghidraLanguage,
    rom: data.rom,
    codeEndExclusiveHex: codeEnd,
    addressingNote: data.addressingNote,
    shippingNote: data.shippingNote,
  },
  sites: data.sites.map((s) => {
    const stubLen = s.stubBytes.hex.length / 2;
    const inBaseline = !!s.landing.inBaselineCode;
    const stale = !!s.landing.coarseMapConflict;
    return {
      id: s.id,
      vectorIndex: s.vectorIndex,
      vectorAddrHex: s.vectorAddrHex,
      stubAddrHex: s.stubAddrHex,
      stubPrologue: s.stubPrologue,
      ljmpAddrHex: s.ljmpAddrHex,
      ghidraAtStub: s.ghidra_insn_at_stub,
      ghidraLjmp: s.ghidra_insn,
      stubRegion: s.region_label,
      landingAddrHex: s.landing.addrHex,
      landingRegion: s.landing.region_label,
      inHighAxxx: !!s.landing.inHighAxxx,
      inBaselineCode: inBaseline,
      coarseMapConflict: stale,
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
      decision: inBaseline
        ? stale
          ? "Baseline: inside CODE (ends 0xB930). Decide: real IRQ handler vs mid-CODE data island; retire stale coarse DATA label. Do not ship yet."
          : "Landing in low CODE window — control case under baseline CODE through 0xB930."
        : "Landing beyond baseline CODE end 0xB930 — still needs human review.",
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
            <Pill size="sm" active={site.coarseMapConflict}>
              {site.coarseMapConflict
                ? "baseline CODE · coarse was DATA"
                : "baseline CODE"}
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
            {site.edgeStatus} · baseline landing {site.landingRegion}
            {site.coarseMapConflict ? " · coarse map was DATA (stale)" : ""}
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
              No Ghidra instructions seeded at landing yet (still inside CODE through 0xB930).
            </Text>
          )}
          <Divider />
          <Text>{site.explanation}</Text>
          <Callout tone={site.coarseMapConflict ? "info" : "neutral"} title="What to decide">
            {site.decision}
          </Callout>
        </Stack>
      </CardBody>
    </Card>
  );
}

export default function IrqStubsReview() {
  const theme = useHostTheme();
  const [filter, setFilter] = useState<"all" | "axxx" | "stale">("all");
  const [openId, setOpenId] = useState<string | null>(REVIEW.sites[0]?.id ?? null);

  const sites = REVIEW.sites.filter((s) => {
    if (filter === "axxx") return s.inHighAxxx;
    if (filter === "stale") return s.coarseMapConflict;
    return true;
  });

  return (
    <Stack gap={20} style={{ padding: 20, background: theme.bg.editor }}>
      <Stack gap={8}>
        <H1>IRQ stubs review</H1>
        <Text tone="secondary">
          RedLabel MCS-96 — baseline CODE through {REVIEW.meta.codeEndExclusiveHex}. 0xAxxx stub
          landings are inside CODE. Source: tools/re/out/irq_stubs_review.json · {REVIEW.meta.rom}
        </Text>
      </Stack>

      <Callout tone="info" title={"Baseline CODE → " + REVIEW.meta.codeEndExclusiveHex}>
        {REVIEW.meta.shippingNote} {REVIEW.meta.addressingNote}
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value={String(REVIEW.meta.siteCount)} label="IRQ stub sites" />
        <Stat
          value={String(REVIEW.meta.baselineCodeLandingCount)}
          label="Inside baseline CODE"
          tone="success"
        />
        <Stat
          value={String(REVIEW.meta.axxxLandingCount)}
          label="0xAxxx in CODE"
          tone="info"
        />
        <Stat
          value={String(REVIEW.meta.staleCoarseDataCount)}
          label="Stale coarse DATA labels"
        />
      </Grid>

      <Stack gap={8}>
        <H2>Filter</H2>
        <Row gap={8} wrap>
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>
            All 8
          </Pill>
          <Pill active={filter === "axxx"} onClick={() => setFilter("axxx")}>
            0xAxxx in CODE (7)
          </Pill>
          <Pill active={filter === "stale"} onClick={() => setFilter("stale")}>
            Stale coarse DATA (7)
          </Pill>
        </Row>
      </Stack>

      <Stack gap={8}>
        <H2>Index</H2>
        <Table
          headers={["Vec", "Stub", "Prologue", "Ghidra", "Landing", "Baseline / coarse"]}
          columnAlign={["left", "left", "left", "left", "left", "left"]}
          rowTone={sites.map((s) => (s.coarseMapConflict ? "info" : "success"))}
          rows={sites.map((s) => [
            String(s.vectorIndex),
            s.stubAddrHex,
            s.stubPrologue,
            s.ghidraLjmp,
            s.landingAddrHex,
            s.coarseMapConflict ? "CODE · coarse was DATA" : "CODE",
          ])}
        />
        <Text size="small" tone="tertiary">
          Richard baseline 413/623 CODE end 0xB930 · PR branch cursor/redlabel-ghidra-re-48cf · CFG
          cross_checked
        </Text>
      </Stack>

      <Stack gap={12}>
        <H2>Sites</H2>
        <Text tone="secondary">
          Expand a site for hex context at the stub and landing. 0xAxxx is not outside CODE under
          the 0xB930 baseline — decide handler vs mid-CODE data island.
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
          Under CODE through 0xB930, each 0xAxxx landing is inside the CODE window. Decide: (1) real
          IRQ handler → keep/seed as CODE; (2) mid-CODE data island → mark data inside CODE range;
          (3) unclear → leave for map work. Retire the old coarse DATA label that assumed CODE ended
          at 0x7FFF. Never promote into definitions/packs/*.shipping.json from this review alone.
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
