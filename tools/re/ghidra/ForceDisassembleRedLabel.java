/* ###
 * Seed disassembly at RedLabel vector targets + CODE window.
 * Raw Binary imports have no natural entry; auto-analysis alone yields 0 instructions.
 * @category BROtronic
 */

import ghidra.app.cmd.disassemble.DisassembleCommand;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.symbol.SourceType;

public class ForceDisassembleRedLabel extends GhidraScript {

	private static final long VECTOR_BASE = 0x2000L;
	private static final int VECTOR_COUNT = 8;
	private static final long CODE_LO = 0x2000L;
	private static final long CODE_HI = 0xB930L; // inclusive baseline CODE end (Richard)

	@Override
	public void run() throws Exception {
		Memory mem = currentProgram.getMemory();
		ensureExecutable(mem);

		AddressSet seeds = new AddressSet();
		for (int i = 0; i < VECTOR_COUNT; i++) {
			long at = VECTOR_BASE + (i * 2L);
			Address vecAddr = toAddr(at);
			int lo = mem.getByte(vecAddr) & 0xff;
			int hi = mem.getByte(vecAddr.add(1)) & 0xff;
			long target = (hi << 8) | lo;
			if (target < CODE_LO || target > CODE_HI) {
				continue;
			}
			Address t = toAddr(target);
			seeds.add(t);
			try {
				currentProgram.getSymbolTable().createLabel(t, "vec_" + i + "_tgt", SourceType.ANALYSIS);
			} catch (Exception e) {
				/* ignore duplicate */
			}
			try {
				currentProgram.getSymbolTable().createLabel(vecAddr, "vec_" + i, SourceType.ANALYSIS);
			} catch (Exception e) {
				/* ignore */
			}
		}

		// Also seed CODE landmarks + known IRQ PC-rel landings in high CODE (≤0xB930)
		long[] extras = new long[] {
			0x2010L, 0x2100L, 0x3000L, 0x4000L, 0x4178L, 0x5000L, 0x6000L, 0x7000L,
			0xA000L, 0xA479L, 0xA49EL, 0xA4A9L, 0xA640L, 0xA88EL, 0xB000L, 0xB930L
		};
		for (long a : extras) {
			Address addr = toAddr(a);
			if (mem.contains(addr) && (mem.getByte(addr) & 0xff) != 0xff) {
				seeds.add(addr);
			}
		}

		int before = countInstructions();
		DisassembleCommand cmd = new DisassembleCommand(seeds, null, true);
		cmd.applyTo(currentProgram, monitor);
		int after = countInstructions();
		println("ForceDisassembleRedLabel: seeds=" + seeds.getNumAddresses()
			+ " instructions " + before + " -> " + after
			+ " language=" + currentProgram.getLanguageID());
	}

	private void ensureExecutable(Memory mem) throws Exception {
		for (MemoryBlock block : mem.getBlocks()) {
			if (!block.isExecute()) {
				block.setExecute(true);
			}
			if (!block.isRead()) {
				block.setRead(true);
			}
		}
	}

	private int countInstructions() {
		int n = 0;
		for (Instruction ignored : currentProgram.getListing().getInstructions(true)) {
			n++;
			if (n > 500000) {
				break;
			}
		}
		return n;
	}
}
