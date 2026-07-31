/* THE ARC ORDER — one source of truth.
 *
 * The eleven keeper files, in reading order.  This list used to be copy-pasted into seven scripts
 * (prose-check, audit-coins, audit-readback, audit-glyphs, audit-watch, tics, and the build), which
 * meant renaming the arc broke six gates one at a time, each with an ENOENT a hundred lines deep.
 * Anything that walks the arc in order requires this.  Anything that just wants "every arc file"
 * should readdir the directory instead, so a new file cannot be silently skipped.
 */
module.exports = ['k1-maren','k2-ren','k3-iso','k4-neru','k5-bram','k6-vess',
                  'k7-ona','k8-senn','k9-cael','k10-tamsin','k11-lio'];
