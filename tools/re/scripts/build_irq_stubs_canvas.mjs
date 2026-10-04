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

const pack = {
  meta: {
    siteCount: data.siteCount,
    axxxLandingCount: data.axxxLandingCount,
    isa: data.isa,
    ghidraLanguage: data.ghidraLanguage,
    rom: data.rom,
    addressingNote: data.addressingNote,
    shippingNote: data.shippingNote,
  },
  sites: data.sites.map((s) => {
    const stubLen = s.stubBytes.hex.length / 2;
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
      inHighAxxx: s.landing.inHighAxxx,
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
      decision: s.landing.inHighAxxx
        ? "Decide: keep DATA_CAL label, carve CODE island at landing, or mark UNKNOWN-pending — do not ship yet."
        : "Landing already in CODE window; low priority vs Axxx conflict sites.",
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
  const conflict = site.landingRegion === "DATA";
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
            <Pill size="sm" active={conflict}>
              {conflict ? "CODE stub → DATA landing" : "CODE stub → CODE landing"}
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
            {site.edgeStatus} · landing region {site.landingRegion}
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
              No Ghidra instructions at landing (outside seeded CODE disasm).
            </Text>
          )}
          <Divider />
          <Text>{site.explanation}</Text>
          <Callout tone={conflict ? "warning" : "info"} title="What to decide">
            {site.decision}
          </Callout>
        </Stack>
      </CardBody>
    </Card>
  );
}

export default function IrqStubsReview() {
  const theme = useHostTheme();
  const [filter, setFilter] = useState<"all" | "axxx" | "code">("all");
  const [openId, setOpenId] = useState<string | null>(REVIEW.sites[0]?.id ?? null);

  const sites = REVIEW.sites.filter((s) => {
    if (filter === "axxx") return s.inHighAxxx;
    if (filter === "code") return s.landingRegion === "CODE";
    return true;
  });

  return (
    <Stack gap={20} style={{ padding: 20, background: theme.bg.editor }}>
      <Stack gap={8}>
        <H1>IRQ stubs review</H1>
        <Text tone="secondary">
          RedLabel MCS-96 — vector table stubs that PC-rel LJMP into high image. Source:
          tools/re/out/irq_stubs_review.json · {REVIEW.meta.rom}
        </Text>
      </Stack>

      <Callout tone="warning" title="Review-only — do not ship">
        {REVIEW.meta.shippingNote} {REVIEW.meta.addressingNote}
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value={String(REVIEW.meta.siteCount)} label="IRQ stub sites" />
        <Stat
          value={String(REVIEW.meta.axxxLandingCount)}
          label="0xAxxx DATA landings"
          tone="warning"
        />
        <Stat value="1" label="CODE control landing" tone="info" />
        <Stat value={REVIEW.meta.ghidraLanguage} label="Ghidra language" />
      </Grid>

      <Stack gap={8}>
        <H2>Filter</H2>
        <Row gap={8} wrap>
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>
            All 8
          </Pill>
          <Pill active={filter === "axxx"} onClick={() => setFilter("axxx")}>
            0xAxxx DATA (7)
          </Pill>
          <Pill active={filter === "code"} onClick={() => setFilter("code")}>
            CODE landing (1)
          </Pill>
        </Row>
      </Stack>

      <Stack gap={8}>
        <H2>Index</H2>
        <Table
          headers={["Vec", "Stub", "Prologue", "Ghidra", "Landing", "Conflict"]}
          columnAlign={["left", "left", "left", "left", "left", "left"]}
          rowTone={sites.map((s) => (s.landingRegion === "DATA" ? "warning" : "info"))}
          rows={sites.map((s) => [
            String(s.vectorIndex),
            s.stubAddrHex,
            s.stubPrologue,
            s.ghidraLjmp,
            s.landingAddrHex,
            s.landingRegion === "DATA" ? "CODE→DATA" : "CODE→CODE",
          ])}
        />
        <Text size="small" tone="tertiary">
          Source: cloud RE evidence pack on PR branch cursor/redlabel-ghidra-re-48cf · CFG
          cross_checked
        </Text>
      </Stack>

      <Stack gap={12}>
        <H2>Sites</H2>
        <Text tone="secondary">
          Expand a site for hex context at the stub and landing, Ghidra decode vs region label,
          and the decision to make.
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
          For each 0xAxxx landing: (1) true IRQ handler code-in-cal → carve CODE island; (2) still
          calibration/data → keep DATA and document trampoline oddity; (3) unclear → leave
          unlabeled for map work. Never promote into definitions/packs/*.shipping.json from this
          review alone.
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
