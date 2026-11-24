#!/usr/bin/env bash
# design-lint.sh: token, motion and copy guard for the app's UI code (docs/app-redesign/DESIGN-DIRECTION.md 7.2).
#
# Usage (from anywhere):
#   tools/design-lint.sh                       check every in-scope file against the per-file baseline
#   tools/design-lint.sh --strict FILE...      zero findings allowed in FILE... (PR-3 WPs, their owned files)
#   tools/design-lint.sh --report [FILE...]    list every finding (file:line pattern text); never fails
#   tools/design-lint.sh --update-baseline     rewrite the baseline from the current counts; refuses to raise a
#                                              count unless --allow-raise is given as well
#   tools/design-lint.sh --self-test           run the lint's own fixtures (must-fail / must-pass) and checks
# Options: --root DIR (the apps/mobile/android folder; default: this script's parent), --baseline FILE,
#          --allow FILE, --copy-allow FILE, --quiet.
#
# Scope: app/src/main/java/com/thesis/mobile/ui/** minus ui/theme, ui/components, ui/charts/kit, ui/motion and
# ui/icons. ui/shell/** and MainViewModel are in scope. Comments are ignored; string literals are not.
# Each pattern is counted per file and compared with tools/design-lint-baseline.txt: a count above the baseline
# fails. A count below it is reported so the WP lowers the baseline in the same commit.
#
# Copy check (same run): string literals in ui/copy/** and literals passed to Text( or as text = "...":
# SPEC banned words (whole words, any case), the em dash and "!". False positives go in
# tools/design-lint-copy-allow.txt; known exceptions to the token patterns in tools/design-lint-allow.txt.
# Allowlist lines: <path suffix>:<line> [pattern-id]  or  <path suffix>:/<substring of the line>/ [pattern-id]
#
# Exit codes: 0 clean (or at/below baseline), 1 findings above baseline / strict findings / self-test failure,
# 2 usage or setup error. Needs bash and perl 5 (both on macOS and the CI image).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BASELINE=""
ALLOW=""
COPY_ALLOW=""
MODE="check"
ALLOW_RAISE=0
QUIET=0
FILES=()

while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT="$(cd "$2" && pwd)"; shift 2 ;;
    --baseline) BASELINE="$2"; shift 2 ;;
    --allow) ALLOW="$2"; shift 2 ;;
    --copy-allow) COPY_ALLOW="$2"; shift 2 ;;
    --strict) MODE="strict"; shift ;;
    --report) MODE="report"; shift ;;
    --update-baseline) MODE="update"; shift ;;
    --allow-raise) ALLOW_RAISE=1; shift ;;
    --self-test) MODE="selftest"; shift ;;
    --quiet) QUIET=1; shift ;;
    -h|--help) sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --*) echo "design-lint: unknown option $1" >&2; exit 2 ;;
    *) FILES+=("$1"); shift ;;
  esac
done

BASELINE="${BASELINE:-$ROOT/tools/design-lint-baseline.txt}"
ALLOW="${ALLOW:-$ROOT/tools/design-lint-allow.txt}"
COPY_ALLOW="${COPY_ALLOW:-$ROOT/tools/design-lint-copy-allow.txt}"

if [ "$MODE" = "selftest" ]; then
  exec bash "$HERE/design-lint/selftest.sh" "$HERE/design-lint.sh"
fi

command -v perl >/dev/null 2>&1 || { echo "design-lint: perl 5 is required" >&2; exit 2; }
[ -d "$ROOT/app/src/main/java/com/thesis/mobile/ui" ] || {
  echo "design-lint: no app/src/main/java/com/thesis/mobile/ui under $ROOT (use --root)" >&2; exit 2; }

export DL_ROOT="$ROOT" DL_BASELINE="$BASELINE" DL_ALLOW="$ALLOW" DL_COPY_ALLOW="$COPY_ALLOW" DL_MODE="$MODE"
export DL_ALLOW_RAISE="$ALLOW_RAISE" DL_QUIET="$QUIET"
exec perl -x "${BASH_SOURCE[0]}" ${FILES[@]+"${FILES[@]}"}

#!perl
# ---- engine ---------------------------------------------------------------------------------------------------
use strict;
use warnings;
use utf8;
use File::Find;
use Cwd ();

# Any die() is a usage/setup error: exit 2, not perl's errno-based code.
$SIG{__DIE__} = sub { print STDERR $_[0]; exit 2 };
binmode STDOUT, ':encoding(UTF-8)';
binmode STDERR, ':encoding(UTF-8)';

my $root = $ENV{DL_ROOT};
my $mode = $ENV{DL_MODE};
my $quiet = $ENV{DL_QUIET};
my $src = "$root/app/src/main/java/com/thesis/mobile";

# Section 7.2 patterns, in order. Ids are what the baseline and allowlists refer to.
my @PATTERNS = (
  ['color-hex',          qr/Color\(0x/],
  ['color-white-black',  qr/Color\.(?:White|Black)/],
  ['sp-literal',         qr/[0-9.]+\.sp\b/],
  ['dp-literal',         qr/\b[1-9][0-9.]*\.dp\b/],
  ['shape-literal',      qr/RoundedCornerShape\([0-9]/],
  ['font-family',        qr/FontFamily\./],
  ['font-size',          qr/fontSize\s*=/],
  ['copy-alpha',         qr/\.copy\(alpha/],
  ['tween',              qr/tween\(/],
  ['spring',             qr/spring\(/],
  ['delay',              qr/\bdelay\(/],
  ['circular-progress',  qr/CircularProgressIndicator\(/],
  ['alert-dialog',       qr/AlertDialog\(/],
  ['outlined-button',    qr/OutlinedButton\(/],
  ['assist-chip',        qr/AssistChip\(/],
  ['string-format',      qr/String\.format\(/],
  ['printf-float',       qr/"%\.[0-9]f"/],
  ['ripple',             qr/rememberRipple\(/],
  ['material-icons',     qr/Icons\.(?:Default|Filled|Outlined|AutoMirrored)\./],
  ['deprecated-colors',  qr/ThesisColors\.(?:AccentBlue|LightBackground|TextPrimaryLight|DarkSurfaceHigh|TextTertiaryDark)/],
);
# Copy pattern ids (docs/deep-dive/SPEC.md section 4).
my $BANNED = qr/\b(?:buy|sell|hold|accumulate|overweight|underweight|outperform|undervalued|overvalued|cheap|expensive|upside|downside|target|entry|exit|stop|opportunity|attractive|bullish|bearish)\b/i;
my @COPY_IDS = ('copy-banned-word', 'copy-em-dash', 'copy-exclamation');
my @ALL_IDS = ((map { $_->[0] } @PATTERNS), @COPY_IDS);
my %KNOWN_ID = map { $_ => 1 } @ALL_IDS;

my @EXCLUDED = map { "ui/$_/" } qw(theme components charts/kit motion icons);

sub in_scope {
  my ($rel) = @_;
  return 0 unless $rel =~ m{^ui/.*\.kt$};
  for my $ex (@EXCLUDED) { return 0 if index($rel, $ex) == 0 }
  return 1;
}

sub slurp {
  my ($path) = @_;
  open(my $fh, '<:encoding(UTF-8)', $path) or die "design-lint: cannot read $path: $!\n";
  local $/;
  my $text = <$fh>;
  close $fh;
  return $text;
}

# Lexes Kotlin just enough to blank out comments (keeping newlines and offsets) and to list string literals
# as [start offset, content]. Handles "..." with escapes and ${...} templates, """raw""", char literals and
# nested /* */ comments.
sub lex {
  my ($text) = @_;
  my @c = split //, $text;
  my $n = scalar @c;
  my @out = @c;
  my @strings;
  my $i = 0;
  my $blank = sub { my ($from, $to) = @_; for my $k ($from .. $to - 1) { $out[$k] = ' ' unless $c[$k] eq "\n" } };
  while ($i < $n) {
    my $ch = $c[$i];
    my $nx = $i + 1 < $n ? $c[$i + 1] : '';
    if ($ch eq '/' && $nx eq '/') {
      my $j = $i; $j++ while $j < $n && $c[$j] ne "\n";
      $blank->($i, $j); $i = $j; next;
    }
    if ($ch eq '/' && $nx eq '*') {
      my ($j, $depth) = ($i + 2, 1);
      while ($j < $n && $depth > 0) {
        if ($c[$j] eq '/' && $j + 1 < $n && $c[$j + 1] eq '*') { $depth++; $j += 2; next }
        if ($c[$j] eq '*' && $j + 1 < $n && $c[$j + 1] eq '/') { $depth--; $j += 2; next }
        $j++;
      }
      $blank->($i, $j); $i = $j; next;
    }
    if ($ch eq "'") { # char literal: 'x', '\n', '−'
      if ($nx eq '\\') {
        my $j = $i + 2; $j++ while $j < $n && $c[$j] ne "'" && $j - $i < 10;
        $i = $j + 1; next;
      }
      if ($i + 2 < $n && $c[$i + 2] eq "'") { $i += 3; next }
      $i++; next;
    }
    if ($ch eq '"') {
      my $raw = ($nx eq '"' && $i + 2 < $n && $c[$i + 2] eq '"');
      my $j = $raw ? $i + 3 : $i + 1;
      my $start = $j;
      my $depth = 0;
      while ($j < $n) {
        if ($depth == 0) {
          if ($raw) { last if $c[$j] eq '"' && $j + 2 < $n && $c[$j + 1] eq '"' && $c[$j + 2] eq '"' }
          else {
            if ($c[$j] eq '\\') { $j += 2; next }
            last if $c[$j] eq '"' || $c[$j] eq "\n";
          }
          if ($c[$j] eq '$' && $j + 1 < $n && $c[$j + 1] eq '{') { $depth = 1; $j += 2; next }
        } else {
          if ($c[$j] eq '{') { $depth++ } elsif ($c[$j] eq '}') { $depth-- }
          elsif ($c[$j] eq '"') { # nested string inside a template: skip it
            my $k = $j + 1;
            while ($k < $n && $c[$k] ne '"' && $c[$k] ne "\n") { $k += ($c[$k] eq '\\') ? 2 : 1 }
            $j = $k;
          }
        }
        $j++;
      }
      push @strings, [$i, join('', @c[$start .. ($j > $start ? $j - 1 : $start - 1)])];
      $i = $raw ? $j + 3 : $j + 1; next;
    }
    $i++;
  }
  return (join('', @out), \@strings);
}

sub line_of {
  my ($text, $offset) = @_;
  return 1 + (substr($text, 0, $offset) =~ tr/\n//);
}

sub line_text {
  my ($text, $line) = @_;
  my @lines = split /\n/, $text, -1;
  my $t = $lines[$line - 1] // '';
  $t =~ s/^\s+|\s+$//g;
  return $t;
}

# Findings for one file: list of [pattern-id, line, excerpt].
sub lint_file {
  my ($rel, $text) = @_;
  my ($code, $strings) = lex($text);
  my @found;
  for my $p (@PATTERNS) {
    my ($id, $re) = @$p;
    while ($code =~ /$re/g) {
      my $line = line_of($code, $-[0]);
      push @found, [$id, $line, line_text($text, $line)];
    }
  }
  my $is_copy = $rel =~ m{^ui/copy/};
  for my $s (@$strings) {
    my ($offset, $content) = @$s;
    unless ($is_copy) {
      my $before = substr($code, 0, $offset);
      next unless $before =~ /(?:\bText\(\s*|\btext\s*=\s*)$/;
    }
    my $plain = $content;
    $plain =~ s/\$\{(?:[^{}]|\{[^{}]*\})*\}/ /g; # ${...} templates
    $plain =~ s/\$[A-Za-z_][A-Za-z0-9_.]*/ /g;     # $name templates
    $plain =~ s/\\u2014/\x{2014}/g;
    my $line = line_of($code, $offset);
    while ($plain =~ /($BANNED)/g) { push @found, ['copy-banned-word', $line, "\"$1\" in: " . line_text($text, $line)] }
    while ($plain =~ /\x{2014}/g) { push @found, ['copy-em-dash', $line, line_text($text, $line)] }
    while ($plain =~ /!(?!=)/g) { push @found, ['copy-exclamation', $line, line_text($text, $line)] }
  }
  return @found;
}

# Allowlist entries: [path suffix, line number or undef, substring or undef, pattern id or undef].
sub read_allow {
  my ($path) = @_;
  my @entries;
  return @entries unless -f $path;
  open(my $fh, '<:encoding(UTF-8)', $path) or die "design-lint: cannot read $path\n";
  while (my $l = <$fh>) {
    chomp $l;
    $l =~ s/\s+#.*$//; $l =~ s/^\s+|\s+$//g;
    next if $l eq '' || $l =~ /^#/;
    if ($l =~ m{^(\S+?):(\d+)(?:\s+(\S+))?$}) { push @entries, [$1, $2, undef, $3] }
    elsif ($l =~ m{^(\S+?):/(.+)/(?:\s+(\S+))?$}) { push @entries, [$1, undef, $2, $3] }
    else { die "design-lint: bad allowlist line in $path: $l\n" }
    die "design-lint: unknown pattern id '$entries[-1][3]' in $path\n"
      if defined $entries[-1][3] && !$KNOWN_ID{$entries[-1][3]};
  }
  close $fh;
  return @entries;
}

sub allowed {
  my ($rel, $f, $entries, $text_lines) = @_;
  my ($id, $line) = @$f;
  for my $e (@$entries) {
    my ($suffix, $eline, $sub, $eid) = @$e;
    next unless $rel eq $suffix || substr($rel, -length($suffix) - 1) eq "/$suffix";
    next if defined $eid && $eid ne $id;
    return 1 if defined $eline && $eline == $line;
    return 1 if defined $sub && index($text_lines->[$line - 1] // '', $sub) >= 0;
  }
  return 0;
}

# ---- collect files
my @rels;
if (@ARGV) {
  for my $arg (@ARGV) {
    my $abs = -e $arg ? Cwd::abs_path($arg) : (-e "$src/$arg" ? Cwd::abs_path("$src/$arg") : undef);
    unless (defined $abs && -f $abs) { print STDERR "design-lint: no such file: $arg\n"; exit 2 }
    my $rel = $abs;
    my $src_abs = Cwd::abs_path($src);
    unless ($rel =~ s{^\Q$src_abs\E/}{}) { print STDERR "design-lint: not under $src: $arg\n"; exit 2 }
    if (!in_scope($rel)) { print STDERR "design-lint: out of scope (kit/theme or not ui/): $rel\n" unless $quiet; next }
    push @rels, $rel;
  }
} else {
  find({ no_chdir => 1, wanted => sub {
    return unless -f $_ && /\.kt$/;
    (my $rel = $File::Find::name) =~ s{^\Q$src\E/}{};
    push @rels, $rel if in_scope($rel);
  } }, "$src/ui");
}
@rels = sort @rels;

my @allow = read_allow($ENV{DL_ALLOW});
my @copy_allow = read_allow($ENV{DL_COPY_ALLOW});

my (%count, @report);
for my $rel (@rels) {
  my $text = slurp("$src/$rel");
  my @lines = split /\n/, $text, -1;
  for my $f (lint_file($rel, $text)) {
    my $list = ($f->[0] =~ /^copy-/) ? \@copy_allow : \@allow;
    next if allowed($rel, $f, $list, \@lines);
    $count{$rel}{$f->[0]}++;
    push @report, [$rel, @$f];
  }
}

# ---- baseline
my %base;
if (-f $ENV{DL_BASELINE}) {
  open(my $fh, '<:encoding(UTF-8)', $ENV{DL_BASELINE}) or die;
  while (my $l = <$fh>) {
    chomp $l; next if $l =~ /^\s*(#|$)/;
    my ($rel, $id, $n) = split /\t/, $l;
    die "design-lint: bad baseline line: $l\n" unless defined $n && $n =~ /^\d+$/ && $KNOWN_ID{$id};
    $base{$rel}{$id} = $n;
  }
  close $fh;
}

sub fmt_finding { my ($r) = @_; sprintf("%s:%d: %s: %s", $r->[0], $r->[2], $r->[1], $r->[3]) }

if ($mode eq 'report') {
  print fmt_finding($_), "\n" for @report;
  my $total = scalar @report;
  print "design-lint: $total finding(s) in ", scalar(keys %count), " of ", scalar(@rels), " file(s)\n";
  exit 0;
}

if ($mode eq 'strict') {
  if (@report) {
    print fmt_finding($_), "\n" for @report;
    print "design-lint --strict: ", scalar(@report), " finding(s); owned files must reach 0 (section 6.3)\n";
    exit 1;
  }
  print "design-lint --strict: 0 findings in ", scalar(@rels), " file(s)\n" unless $quiet;
  exit 0;
}

if ($mode eq 'update') {
  my @raised;
  for my $rel (sort keys %count) {
    for my $id (sort keys %{ $count{$rel} }) {
      my $was = $base{$rel}{$id} // 0;
      push @raised, "$rel $id $was -> $count{$rel}{$id}" if $count{$rel}{$id} > $was;
    }
  }
  if (@raised && !$ENV{DL_ALLOW_RAISE} && -f $ENV{DL_BASELINE}) {
    print STDERR "design-lint: refusing to raise the baseline (pass --allow-raise if this is deliberate):\n";
    print STDERR "  $_\n" for @raised;
    exit 1;
  }
  open(my $fh, '>:encoding(UTF-8)', $ENV{DL_BASELINE}) or die "design-lint: cannot write $ENV{DL_BASELINE}\n";
  print $fh "# design-lint baseline: <file under app/src/main/java/com/thesis/mobile>\\t<pattern>\\t<count>\n";
  print $fh "# Generated by tools/design-lint.sh --update-baseline. Counts may only go down (section 7.2).\n";
  my $total = 0;
  for my $rel (sort keys %count) {
    for my $id (@ALL_IDS) {
      next unless $count{$rel}{$id};
      print $fh "$rel\t$id\t$count{$rel}{$id}\n";
      $total += $count{$rel}{$id};
    }
  }
  close $fh;
  print "design-lint: baseline written ($total findings in ", scalar(keys %count), " files)\n";
  exit 0;
}

# check
my (@over, @under);
for my $rel (@rels) {
  for my $id (@ALL_IDS) {
    my $now = $count{$rel}{$id} // 0;
    my $was = $base{$rel}{$id} // 0;
    if ($now > $was) { push @over, [$rel, $id, $was, $now] }
    elsif ($now < $was) { push @under, [$rel, $id, $was, $now] }
  }
}
if (@over) {
  for my $o (@over) {
    my ($rel, $id, $was, $now) = @$o;
    print "$rel: $id: $now finding(s), baseline $was\n";
    print "    ", fmt_finding($_), "\n" for grep { $_->[0] eq $rel && $_->[1] eq $id } @report;
  }
  print "design-lint: ", scalar(@over), " count(s) above the baseline. Use the tokens in ui/theme (section 2),\n",
        "or, for a reviewed exception, add it to tools/design-lint-allow.txt / design-lint-copy-allow.txt.\n";
  exit 1;
}
unless ($quiet) {
  if (@under) {
    print "design-lint: below baseline (lower it in this commit: tools/design-lint.sh --update-baseline):\n";
    printf "    %s: %s %d -> %d\n", @$_ for @under;
  }
  print "design-lint: OK, ", scalar(@report), " finding(s) in ", scalar(@rels), " file(s), none above the baseline\n";
}
exit 0;
