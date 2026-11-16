package mv.opro.hrms.common;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.Locale;

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

    // A readable code from a name HR typed: "Marriage leave" becomes "marriage-leave". Empty if it has no letters or numbers.
    public static String codeFor(String name, int maxLength) {
        String code = Normalizer.normalize(name.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        return code.length() > maxLength ? code.substring(0, maxLength).replaceAll("-$", "") : code;
    }
}
