package mv.opro.hrms.common;

import java.security.SecureRandom;
import java.util.HexFormat;

// Short readable ids like LR-3F9A21C0. Random, so they can't be guessed or counted.
public final class Ids {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int BYTES = 4;

    private Ids() {}

    public static String next(String prefix) {
        byte[] bytes = new byte[BYTES];
        RANDOM.nextBytes(bytes);
        return prefix + "-" + HexFormat.of().withUpperCase().formatHex(bytes);
    }
}
