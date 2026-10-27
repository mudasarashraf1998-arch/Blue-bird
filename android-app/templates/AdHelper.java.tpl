package __PACKAGE__;

import android.content.Context;

/** Stub that stands in for a real ad SDK in the reference build. */
public final class AdHelper {
    public static final String AD_APP_ID = "ca-app-pub-3940256099942544~3347511713";
    public static final String AD_UNIT_ID = "ca-app-pub-3940256099942544/6300978111";
    public static final String AD_ENDPOINT = "https://googleads.g.doubleclick.net/mads/static/mad/sdkunit/core/view.html";
    public static final String TRACKING_HOST = "https://pagead2.googlesyndication.com/pagead/gen_204";
    public static final String INTERSTITIAL_HOST = "https://googleads.g.doubleclick.net/mads/gma";

    public static void loadBanner(Context context) { /* would fetch and render a remote banner */ }
    public static void showInterstitial(Context context) { /* would fetch a full-screen ad */ }
}
