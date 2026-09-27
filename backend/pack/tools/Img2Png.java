import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;

/**
 * Convert any ImageIO-readable image (PNG/JPEG/GIF/BMP) to PNG.
 * usage: Img2Png &lt;input&gt; &lt;output.png&gt; [size] [mode]
 * mode=square (default): force size×size
 * mode=max: scale so max(w,h) &lt;= size, keep aspect (size=0 keeps original)
 */
public class Img2Png {
  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      System.err.println("usage: Img2Png <input> <output.png> [size] [square|max]");
      System.exit(2);
    }
    File in = new File(args[0]);
    File out = new File(args[1]);
    int size = args.length >= 3 ? Integer.parseInt(args[2]) : 0;
    String mode = args.length >= 4 ? args[3].trim().toLowerCase() : "square";
    BufferedImage src = ImageIO.read(in);
    if (src == null) {
      System.err.println("unsupported or corrupt image: " + in.getAbsolutePath());
      System.exit(1);
    }
    int w = src.getWidth();
    int h = src.getHeight();
    if (size > 0) {
      if ("max".equals(mode)) {
        int maxSide = Math.max(w, h);
        if (maxSide > size) {
          double scale = (double) size / maxSide;
          w = Math.max(1, (int) Math.round(w * scale));
          h = Math.max(1, (int) Math.round(h * scale));
        }
      } else {
        w = size;
        h = size;
      }
    }
    BufferedImage dst = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g = dst.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.drawImage(src, 0, 0, w, h, null);
    g.dispose();
    out.getParentFile().mkdirs();
    if (!ImageIO.write(dst, "png", out)) {
      System.err.println("failed to write png");
      System.exit(1);
    }
  }
}
