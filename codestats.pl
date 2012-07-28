#!/usr/bin/env perl

use warnings;
use strict;

my %excludes = (
    'd3.v2.min.js'        => 1,
    'jquery-1.7.2.min.js' => 1,
    'json2.js'            => 1,
    'underscore-min.js'   => 1,
    );

system("git co master 2> /dev/null") == 0 or die "checkout failed: $?";

open(IN, "git log --pretty='format:%H %at %s' |") or die $!;
my @loglines = <IN>;
close IN;

print "var codestats = [\n";
foreach (@loglines) {
    chomp;
    my ($sha, $utc, $subject) = split ' ', $_, 3;

    system("git co $sha 2> /dev/null") == 0 or die "checkout failed: $?";

    opendir(DIR, ".") or die $!;
    my @files = grep { /.js$/ and not $excludes{$_} } readdir(DIR);
    closedir DIR;

    my $lines = @files ? `cat @files | wc -l` : '0';
    $lines =~ s/\s*(\S+)\s*/$1/;

    #print "/* $subject files: @files */\n";
    print "  { utc: $utc, lines: $lines }\n";
    system("git co master 2> /dev/null") == 0 or die "checkout failed: $?";
}
print "];\n";

__END__
