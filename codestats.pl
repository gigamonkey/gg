#!/usr/bin/env perl

use warnings;
use strict;

my %excludes = (
    'd3.v2.min.js'        => 1,
    'jquery-1.7.2.min.js' => 1,
    'json2.js'            => 1,
    'underscore-min.js'   => 1,
    'codestats.js'        => 1,
    );

system("git stash &> /dev/null") == 0 or die "stash failed: $?";
system("git co master &> /dev/null") == 0 or die "checkout failed: $?";

open(IN, "git log --no-merges --pretty='format:%H %at %ae' |") or die $!;
my @loglines = <IN>;
close IN;

my @data = ();

foreach (@loglines) {
    chomp;
    my ($sha, $utc, $author) = split ' ', $_, 4;

    $utc *= 1000; # for Javascript

    system("git co $sha &> /dev/null") == 0 or die "checkout failed: $?";

    opendir(DIR, ".") or die $!;
    my @files = grep { /.js$/ and not $excludes{$_} } readdir(DIR);
    closedir DIR;

    my $lines = @files ? `cat @files | wc -l` : '0';
    $lines =~ s/\s*(\S+)\s*/$1/;

    push @data, "{ utc: $utc, lines: $lines, author: \"$author\" },";
    system("git co master &> /dev/null") == 0 or die "checkout failed: $?";
}


print "var codestats = [\n";
foreach (sort @data) {
    print "  $_\n";
}
print "];\n";
#system("git stash apply &> /dev/null") == 0 or die "stash failed: $?";

__END__
