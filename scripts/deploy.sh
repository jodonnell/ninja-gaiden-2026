git branch -D deploy
git checkout -b deploy
npm run build
mv dist/index.html .
cp -R dist/assets/* ./assets/
git add index.html
git add assets
git commit -m "deploy commit"
git push origin deploy -f
rm -rf assetsbk
git checkout main
