if [ ! -d icons ]; then
     mkdir icons
fi

seq 108682 1 108882 | xargs -P 10 -I {} wget --quiet --output-document "icons/icons8-{}-96.png" "https://img.icons8.com/?id={}&format=png&size=96&name=icons8-{}-96.png&fromSite=true"