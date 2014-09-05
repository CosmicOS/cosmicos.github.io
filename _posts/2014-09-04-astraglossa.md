---
title: Astraglossa
layout: post
---

Lancelot Hogben described Astraglossa in a 
lecture to the British Interplanetary 
Society in 1952, later reprinted as Chapter 8 of his book Science in Authority
(<a href="https://archive.org/details/scienceinauthori000812mbp">full text available online</a>) as:

<div class="midpic"><img src="/images/astraglossa.png" alt="ASTRAGLOSSA or FIRST STEPS IN CELESTIAL SYNTAX" title="ASTRAGLOSSA or FIRST STEPS IN CELESTIAL SYNTAX" /></div>

The text is interesting. I don't think I got all the jokes, not being
a British person in the 1950s. But it is definitely a lively piece of
writing, in an old-timey pre-twitter way.  George Orwell once singled out
Ogden's use of metaphors as an example of how not to write, and I admit
to being struck at how hard it can be to quite follow a fellow human 
(or co-planetarian as Hogben puts it), never mind communicating further
afield. But I'm in no position to cast stones.

Hogben mulls over how to get started communicating and comes up with this:

> Number will initially be our common idiom of reciprocal recognition;
> and astronomy will be the topic of our first factual conversations.

This is the earliest I've seen this idea written down.  Hogben expects
that:

> beings able to contemplate the firmament and to organize
> settled life in conformity to the <i>dictates of seasonal change</i>
> will share with us the abstract concept of number.

Others have since made very different arguments for similar expectations
of numeracy,
for example Marvin Minsky's <a href="http://web.media.mit.edu/~minsky/papers/AlienIntelligence.html">argument from sparseness</a>.
It is good to see the same idea popping out of humans that are quite
alien to each other (although not diverse by any means).
Astronomy as being a good source of facts to talk about is likewise an idea
that keeps cropping up in proposed messages (though granted most people
involved in this field are really big into astronomy).

Syntax
------

Hogben sketches a radio message made up of these parts:

 - *Dashes*, a small number of simple elements
 - *Flashes*, a larger "<span class='bq'>battery of signals each recognizable as a <i>Gestalt</i></span>"
 - A system of punctuation based on rank order and interval

The details are left underspecified, but there are some examples given.

The entrance examination
------------------------

Hogben imagines sending this message that he calls "the entrance examination":

> I + II + III = VI

Which he renders as follows:

> 1 . . F<sub>a</sub> . . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>b</sub> . . 1 . 1 . 1 . 1 . 1 . 1

The <span class='bq'>F</span> parts are "flashes," with 
<span class='bq'>F<sub>a</sub></span> corresponding
to <tt>+</tt> and <span class='bq'>F<sub>b</sub></span> corresponding 
to <tt>=</tt>.  Numbers are represented in unary, using alternating 
dashes and dots. Lining up the parts just to make this clear:

> | I |     | +             |     | II    |     | +             |     | III       |     | =             |     | VI                    |
> |:-:| --- | ------------- | --- | ----- | --- | ------------- | --- | --------- | --- | ------------- | --- | --------------------- |
> | 1 | . . | F<sub>a</sub> | . . | 1 . 1 | . . | F<sub>a</sub> | . . | 1 . 1 . 1 | . . | F<sub>b</sub> | . . | 1 . 1 . 1 . 1 . 1 . 1 |

Remember this represents a radio broadcast, don't read too much into the exact characters used.
The next thing Hogben suggests is introducing new vocabulary, in this case a symbol 
<span class='bq'>F<sub>s</sub></span> for the number <span class='bq'>6</span>, by adding an extra equality as follows:

> 1 . . F<sub>a</sub> . . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . <b>F<sub>b</sub> . . F<sub>s</sub> . . F<sub>b</sub></b> . . 1 . 1 . 1 . 1 . 1 . 1

The next step
-------------

Hogben weighs the next step after these preliminaries:

> Here we assume that the class is attentive. We then reach a cross-road.
> Shall we start the school day with a lesson in arithmetic or with a lesson in astronomy?

He arrives at the conclusion that trying for astronomy would result in trying to teach some arithmetic at the same time, so:

> ... we now decide to divide our curriculum into a fresher course on number-lore and a sophomore course on star-lore.

He breaks down the purpose of the "number-lore" course as follows:

 - First, to get across that the signal received is really a message, not just some artifact.
 - Second, to be able to express the numeric concepts that will be needed in the "star-lore" course.

Then he gets really excited about the triangular numbers for some reason (1, 1+2, 1+2+3, 1+2+3+4), and with some
hand-waving suggests that we "<span class='bq'>can rewrite trigonometry for the Martians by recourse to definitions in terms
of infinite series</span>."  Don't get me wrong, I'm not complaining about the hand-waving, this was one short lecture
after all.

Concretely, he introduces "flashes" for marking statements derived from a particular rule. Here is a rule called <span class='bq'>F<sub>r&middot;1</sub></span> in action:

> F<sub>r&middot;1</sub> . . 1 . . F<sub>a</sub> . . 1 . . F<sub>b</sub> . . 1 . 1 <span class='exp'>(1+1=2)</span><br />
> F<sub>r&middot;1</sub> . . 1 . . F<sub>a</sub> . . 1 . . 1 . . F<sub>b</sub> . . 1 . 1 . 1 <span class='exp'>(1+2=3)</span><br />
> F<sub>r&middot;1</sub> . . 1 . . F<sub>a</sub> . . 1 . . 1 . . 1 . . F<sub>b</sub> . . 1 . 1 . 1 . 1 <span class='exp'>(1+3=4)</span>

And here is rule <span class='bq'>F<sub>r&middot;2</sub></span> in action:

> F<sub>r&middot;2</sub> . . 1 . . F<sub>a</sub> . . 1 . 1 . . F<sub>b</sub> . . 1 . 1 . 1 <span class='exp'>(1+2=3)</span><br />
> F<sub>r&middot;2</sub> . . 1 . . F<sub>a</sub> . . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>b</sub> . . 1 . 1 . 1 . 1 . 1 . 1 <span class='exp'>(1+2+3=6)</span><br />
> F<sub>r&middot;2</sub> . . 1 . . F<sub>a</sub> . . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . 1 . . F<sub>b</sub> . . 1 . 1 . 1 . 1 . 1 . 1 . 1 . 1 . 1 . 1<br /><span class='exp'>(1+2+3+4=10)</span>

Rules are interesting because they let us show counterexamples and
start to ask questions, in a passage Hogben calls:

A first lesson in celestial syntax
----------------------------------

Hogben notes that when we establish "rules" with fragments like this we
are giving affirmative examples of that rule:

> F<sub>r&middot;1</sub> . . 1 . . F<sub>a</sub> . . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>b</sub> . . F<sub>s</sub> <span class='exp'>(1+2+3=6)</span>

<span class='bq'>F<sub>r&middot;1</sub></span> here seems different than what it was earlier in the lecture. Let's not worry about that.  Also remember that
<span class='bq'>F<sub>s</sub></span> is just `6`.
If we can give affirmative examples, why not also give negative examples:

> F<sub>n&middot;1</sub> . . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>b</sub> . . F<sub>s</sub> <span class='exp'>(1+3+3=6)</span>

In notation we've replaced <span class='bq'>F<sub><b>r</b>&middot;1</sub></span> with <span class='bq'>F<sub><b>n</b>&middot;1</sub></span>, corresponding to some manipulation of the radio signal.

And then we can consider replacing part of a fragment, replacing it with
a "flash" that acts as an interrogative, corresponding to asking the question
"what should go here?"  This would look something like:

> 1 . . F<sub>a</sub> . . F<sub>q</sub> . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>b</sub> . . F<sub>s</sub> <span class='exp'>(1+?+3=6)</span>

I'm simplifying the discussion of <span class='bq'>F<sub>q</sub></span> a 
little here, it can have some internal structure that doesn't seem to get
used in the lecture.

A second lesson in celestial syntax
-----------------------------------

Hogben now reuses the interrogative <span class='bq'>F<sub>q</sub></span>,
the affirmative <span class='bq'>F<sub>r</sub></span>, and the
negation <span class='bq'>F<sub>n</sub></span>
as the core of a question-answer pattern.
He adds one element, the _alternative_ <span class='bq'>F<sub>o</sub></span>.
Here is the example he gives:

> F<sub>q</sub> . . 1 . . F<sub>a</sub> . . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>b</sub> . . F<sub>s</sub> . . F<sub>o</sub> . . F<sub>q</sub> . . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>b</sub> . . F<sub>s</sub> <span class='exp'>(? 1+2+3=6 or ? 1+3+3=6)</span><br />
> F<sub>r</sub> . . 1 . . F<sub>a</sub> . . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>b</sub> . . F<sub>s</sub> <span class='exp'>(confirmation 1+2+3=6)</span><br />
> F<sub>n</sub> . . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>a</sub> . . 1 . 1 . 1 . . F<sub>b</sub> . . F<sub>s</sub> <span class='exp'>(denial 1+3+3=6)</span>

(The text says <span class='bq'>N<sub>r</sub></span> instead of 
<span class='bq'>F<sub>n</sub></span> but I'm pretty sure this is a typo).

We-you
------

Hogben proposes that:

> we can establish the bipolar concept _we-you_ by juxtaposition and repetition
> of already received and transmitted signals, as soon as we have solved the
> problem of identifying the interplanetary interrogative particle (F<sub>q</sub>).

And then tries to imagine how to ask a question "how many of you are there?"
It gets pretty hand-wavy at this point, as befits he end of a lecture.

Should we communicate?
----------------------

Hogben enjoys this "<span class='bq'>challenge to cerebration</span>" but does not take for
granted that trying for interstellar communication is a good thing:

> Before we have proven ourselves worthy to occupy our own planet 
> we may well dread the consequences of publicizing our existence
> to beings conceivably intelligent enough to forestall any depredations 
> we may contemplate in other 
> parts of the solar system. When we reflect upon the trail of still 
> unsolved problems of race relations in the wake of the slave-raiding 
> bible-punching buccaneers of the first Elizabethan era, we may 
> permissibly share Dean Swift's doubts about the fitness of man to 
> undertake indiscriminate exploits in colonization. 


Text
----

<ul class="index">
<li><a href="https://archive.org/details/scienceinauthori000812mbp">Science in Authority, full text</a></li>
</ul>
