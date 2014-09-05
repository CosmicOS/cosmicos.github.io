killall jekyll
killall -9 jekyll
killall ruby
killall -9 ruby
source "$HOME/.rvm/scripts/rvm"
rvm use ruby-1.9.3-p194
jekyll serve --watch --baseurl ''
