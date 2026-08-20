#!/bin/sh
# frames/ -> crane.webm, using the ffmpeg that ships with Playwright.
# That build is a minimal one: VP8 is the only video encoder, there is no image2
# demuxer and no pipe protocol, so the frames go in as a single concatenated
# mjpeg stream read from a file. A full ffmpeg would just take -i frames/f%04d.jpg
# and libx264; this is the version that is already on the machine.
set -e
D=$(dirname "$0")
FF=${FFMPEG:-$(ls -d /opt/pw-browsers/ffmpeg-*/ffmpeg-linux 2>/dev/null | head -1)}
[ -x "$FF" ] || { echo "no ffmpeg found; set FFMPEG=/path/to/ffmpeg" >&2; exit 1; }
cat "$D"/frames/f*.jpg > "$D/all.mjpg"
"$FF" -hide_banner -y -f image2pipe -c:v mjpeg -framerate 24 -i "file:$D/all.mjpg" \
      -c:v libvpx -b:v 3500k -pix_fmt yuv420p -f webm "file:$D/crane.webm"
rm -f "$D/all.mjpg"
echo "$D/crane.webm"
