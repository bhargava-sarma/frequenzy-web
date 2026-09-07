/**
 * The room the app sits in.
 *
 * Three very slow gradient blobs in the artwork's colours, held far enough back
 * that they never compete with content — but present enough that translucent
 * chrome has something to pick up. Without this the app is flat black and every
 * glass surface looks like painted plastic.
 */

export function AmbientBackdrop() {
  return (
    <div className="fz-backdrop" aria-hidden="true">
      <div className="fz-backdrop__blob" />
      <div className="fz-backdrop__blob" />
      <div className="fz-backdrop__blob" />
      <div className="fz-backdrop__vignette" />
      <div className="fz-backdrop__grain" />
    </div>
  );
}
