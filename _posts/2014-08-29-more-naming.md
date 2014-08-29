---
layout: post
title: A question of character
---

A [previous post]({% post_url 2014-04-24-naming %}) mentioned that
names in CosmicOS were not being encoded in as useful a form as they
could be.  For example, addition (<tt>+</tt>) was encoded as 
the number <tt>10</tt>, meaning:

> &ldquo;the 10<sup>th</sup> thing on an imaginary list of things.&rdquo;

This reduced the complexity of the language the message was written in, 
since everything was just a list of numbers.  This was very helpful
especially in the parts of the message that *change* that language
programmatically, a handy kind of bootstrapping.  But there's a 
downside.

The number <tt>10</tt> is not a very useful thing to search for.
There will be a lot of chaff if you search the message for all instances
of <tt>10</tt>.  In a [previous post]({% post_url 2014-04-24-naming %}) 
I suggested just using much bigger numbers, like <tt>345391</tt>.
Any user of a search engine knows it is more productive to search for 
something long and quirky than something short and generic.

Ideally, we'd like names to be quirky and easy to search for and
recognize directly in a recording of whatever stream the receiver
gets.  We want names that are distinctive on as low a level as
possible in the medium being used.  For just about any model of 
the receiver's intelligence, this will help them out.
Distinctive numbers are okay, but maybe we can do better with 
pops and squeals and gurgles and who knows what?  We have to 
at some point consider error correction and compression, but that 
can be something we bootstrap to once the essentials of communication 
are in place.

To summarize:
In the past, CosmicOS assumed that the lowest level representation
would be a small number of basic symbols into which the message is
encoded.  We no longer assume that.  If there's space in the physical
medium for more expression, let's use it in order to reduce the
cognitive burden on the receiving end.  Hammering this out will
require careful thought on the details of error probabilities and
error correction.  CosmicOS should offer flexibility so the message
can be better adapted to the opportunities afforded by the medium.

As a visualization of this on paper/screen, I'm working on a re-rendering
of the message using goofy icons drawn from 
<a href="http://thenounproject.com/">The Noun Project</a>.
Here's a fragment:

![iconifying cosmicos](/images/iconifying_cosmicos.png)

<ul class="index">
<li><a href="/next.html">More here</a></li>
</ul>

More fun will be to also build an acoustic version.  You can 
hear an acoustic rendition of any phrase of the message
already on the <a href="/message.html">plain-text message</a>
page, but it'll sound way more interesting with 
character-ful names.

