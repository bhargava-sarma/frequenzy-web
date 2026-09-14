/**
 * The room the app sits in.
 *
 * A wash carrying the whole artwork palette at once, three very slow gradient
 * blobs on top of it, and a vignette to push the edges back — held far enough
 * behind the content that they never compete with it, but present enough that
 * translucent chrome has something to pick up. Without this the app is flat
 * black and every glass surface looks like painted plastic.
 */

export function AmbientBackdrop() {
  return (
    <div className="fz-backdrop" aria-hidden="true">
      <div className="fz-backdrop__wash" />
      <div className="fz-backdrop__blob fz-backdrop__blob--a" />
      <div className="fz-backdrop__blob fz-backdrop__blob--b" />
      <div className="fz-backdrop__blob fz-backdrop__blob--c" />
      <div className="fz-backdrop__vignette" />
      <div className="fz-backdrop__grain" />
    </div>
  );
}
