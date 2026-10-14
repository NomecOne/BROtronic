/* ###
 * Export RedLabel CODE artifacts for BROtronic tools/re
 * @category BROtronic
 */

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolIterator;
import ghidra.program.model.symbol.SymbolType;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

public class ExportRedLabel extends GhidraScript {

	@Override
	public void run() throws Exception {
		File outDir = resolveOutDir();
		if (!outDir.exists() && !outDir.mkdirs()) {
			printerr("Cannot create out dir: " + outDir.getAbsolutePath());
			return;
		}

		String lang = currentProgram.getLanguageID().getIdAsString();
		String compiler = currentProgram.getCompilerSpec().getCompilerSpecID().getIdAsString();
		long size = currentProgram.getMemory().getSize();

		int insnCount = writeListing(outDir);
		writeFunctions(outDir);
		writeSymbols(outDir);
		writeMeta(outDir, lang, compiler, size, insnCount);
		writeSanity(outDir, lang, insnCount);

		println("BROtronic ExportRedLabel wrote artifacts to " + outDir.getAbsolutePath()
			+ " instructions=" + insnCount);
	}

	private File resolveOutDir() {
		String[] args = getScriptArgs();
		if (args != null && args.length > 0 && args[0] != null && args[0].trim().length() > 0) {
			return new File(args[0]);
		}
		String env = System.getenv("BROTRONIC_GHIDRA_OUT");
		if (env != null && env.trim().length() > 0) {
			return new File(env);
		}
		return new File(System.getProperty("user.home"), "brotronic_ghidra_out");
	}

	private void writeMeta(File outDir, String lang, String compiler, long size, int insnCount) throws Exception {
		StringBuilder sb = new StringBuilder();
		sb.append("{\n");
		sb.append("  \"schemaVersion\": 1,\n");
		sb.append("  \"program\": ").append(json(currentProgram.getName())).append(",\n");
		sb.append("  \"language\": ").append(json(lang)).append(",\n");
		sb.append("  \"compiler\": ").append(json(compiler)).append(",\n");
		sb.append("  \"memorySize\": ").append(size).append(",\n");
		sb.append("  \"imageBase\": ").append(json(currentProgram.getImageBase().toString())).append(",\n");
		sb.append("  \"instructionCount\": ").append(insnCount).append(",\n");
		sb.append("  \"functionCount\": ").append(currentProgram.getFunctionManager().getFunctionCount()).append(",\n");
		sb.append("  \"namingNote\": \"C16x900A in ROM filename is CS16 fingerprint 0x900A, not a C16x language ID\",\n");
		sb.append("  \"verificationStatus\": \"unverified\"\n");
		sb.append("}\n");
		writeText(new File(outDir, "ghidra_export_meta.json"), sb.toString());
	}

	private void writeSanity(File outDir, String lang, int insnCount) throws Exception {
		StringBuilder sb = new StringBuilder();
		sb.append("{\n");
		sb.append("  \"schemaVersion\": 1,\n");
		sb.append("  \"language\": ").append(json(lang)).append(",\n");
		sb.append("  \"instructionCount\": ").append(insnCount).append(",\n");
		sb.append("  \"functionCount\": ").append(currentProgram.getFunctionManager().getFunctionCount()).append(",\n");
		sb.append("  \"sampleAt4178\": ").append(json(insnAt(0x4178))).append(",\n");
		sb.append("  \"sampleAt417C\": ").append(json(insnAt(0x417c))).append(",\n");
		sb.append("  \"sampleAt2000\": ").append(json(insnAt(0x2000))).append(",\n");
		sb.append("  \"namingNote\": \"C16x900A = CS16 0x900A only\",\n");
		boolean looksMcs96 = lang.startsWith("MCS96");
		boolean looksX86 = lang.startsWith("x86");
		sb.append("  \"notes\": [\n");
		sb.append("    \"Raw binary required ForceDisassembleRedLabel seeds at LE16 vectors @0x2000\",\n");
		if (looksX86 && insnCount == 0) {
			sb.append("    \"x86 Real Mode produced 0 instructions even after seeding — strong negative evidence\",\n");
		} else if (looksX86) {
			sb.append("    \"Inspect whether seeded sites decode as coherent 8086 control flow or nonsense\",\n");
		}
		if (looksMcs96) {
			sb.append("    \"MCS-96 locked: LJMP/LCALL use PC-relative disp16 (Intel + SLEIGH); see blocker1_ljmp_lcall.md\",\n");
		}
		sb.append("    \"Do not promote CODE-derived maps until verificationStatus is raised\"\n");
		sb.append("  ]\n");
		sb.append("}\n");
		writeText(new File(outDir, "ghidra_sanity.json"), sb.toString());
	}

	private String insnAt(long off) {
		Address a = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(off);
		Instruction ins = currentProgram.getListing().getInstructionAt(a);
		if (ins == null) {
			return null;
		}
		return a.toString() + "  " + ins.toString();
	}

	private void writeFunctions(File outDir) throws Exception {
		StringBuilder sb = new StringBuilder();
		sb.append("entry,entry_hex,name,body_size,is_thunk\n");
		FunctionIterator it = currentProgram.getFunctionManager().getFunctions(true);
		while (it.hasNext()) {
			Function fn = it.next();
			Address entry = fn.getEntryPoint();
			long body = fn.getBody() != null ? fn.getBody().getNumAddresses() : 0;
			sb.append(entry.getOffset()).append(',')
				.append(entry.toString()).append(',')
				.append(csv(fn.getName())).append(',')
				.append(body).append(',')
				.append(fn.isThunk()).append('\n');
		}
		writeText(new File(outDir, "ghidra_functions.csv"), sb.toString());
	}

	private void writeSymbols(File outDir) throws Exception {
		StringBuilder sb = new StringBuilder();
		sb.append("address,address_hex,name,type,primary\n");
		SymbolIterator it = currentProgram.getSymbolTable().getAllSymbols(true);
		int n = 0;
		while (it.hasNext()) {
			Symbol sym = it.next();
			SymbolType t = sym.getSymbolType();
			if (t != SymbolType.FUNCTION && t != SymbolType.LABEL) {
				continue;
			}
			Address a = sym.getAddress();
			sb.append(a.getOffset()).append(',')
				.append(a.toString()).append(',')
				.append(csv(sym.getName())).append(',')
				.append(csv(t.toString())).append(',')
				.append(sym.isPrimary()).append('\n');
			n++;
			if (n > 200000) {
				break;
			}
		}
		writeText(new File(outDir, "ghidra_symbols.csv"), sb.toString());
	}

	private int writeListing(File outDir) throws Exception {
		StringBuilder sb = new StringBuilder();
		sb.append("; BROtronic RedLabel listing export\n");
		sb.append("; language=").append(currentProgram.getLanguageID()).append('\n');
		sb.append("; NOTE: canonical language MCS96:LE:16:default; LJMP/LCALL are PC-relative (not C16x from filename)\n\n");

		Address start = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(0x2000);
		boolean hasCodeWindow = currentProgram.getMemory().contains(start);
		InstructionIterator ii = hasCodeWindow
			? currentProgram.getListing().getInstructions(start, true)
			: currentProgram.getListing().getInstructions(true);

		int count = 0;
		final int MAX = 25000;
		while (ii.hasNext() && count < MAX) {
			Instruction ins = ii.next();
			Address a = ins.getAddress();
			if (hasCodeWindow && a.getOffset() > 0xB930) {
				break;
			}
			sb.append(a.toString()).append("  ").append(ins.toString()).append('\n');
			count++;
		}
		sb.append("\n; exported_instructions=").append(count).append('\n');
		writeText(new File(outDir, "ghidra_listing.txt"), sb.toString());
		return count;
	}

	private static void writeText(File f, String text) throws Exception {
		try (OutputStreamWriter w = new OutputStreamWriter(new FileOutputStream(f), StandardCharsets.UTF_8)) {
			w.write(text);
		}
	}

	private static String csv(String s) {
		if (s == null) {
			return "";
		}
		String t = s.replace("\"", "\"\"");
		if (t.indexOf(',') >= 0 || t.indexOf('"') >= 0) {
			return "\"" + t + "\"";
		}
		return t;
	}

	private static String json(String s) {
		if (s == null) {
			return "null";
		}
		return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
	}
}
