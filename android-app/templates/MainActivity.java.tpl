package __PACKAGE__;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Tiny tap-counter app. The reference build carries an ad surface; the ad-free build does not. */
public class MainActivity extends Activity {
    private int taps = 0;
    private TextView counter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.rgb(11, 26, 46));
        root.setPadding(48, 64, 48, 64);

        TextView title = new TextView(this);
        title.setText("__LABEL__");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        counter = new TextView(this);
        counter.setText("Taps: 0");
        counter.setTextColor(Color.rgb(159, 197, 255));
        counter.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        counter.setGravity(Gravity.CENTER);
        counter.setPadding(0, 40, 0, 40);
        root.addView(counter);

        Button button = new Button(this);
        button.setText("Tap me");
        button.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                taps++;
                counter.setText("Taps: " + taps);
            }
        });
        root.addView(button);
__ADS_BLOCK__
        setContentView(root);
    }
}
