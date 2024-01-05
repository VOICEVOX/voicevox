# tests/e2e/browser/assets

このディレクトリには、VRT テストで使う、ダミーの立ち絵とアイコンが入っています。

このディレクトリ内の画像は [Dynamic Dummy Image Generator](https://dummyimage.com/) で生成しました。
以下のスクリプトでダウンロードしました：

```ruby
require "http"

colors = [
  [1, 0, 0],
  [1, 0.5, 0],
  [1, 1, 0],
  [0.5, 1, 0],
  [0, 1, 0],
  [0, 1, 0.5],
  [0, 1, 1],
  [0, 0.5, 1],
  [0, 0, 1],
  [0.5, 0, 1],
  [1, 0, 1],
  [1, 0, 0.5]
]

COUNT = 5 # 追加したいときはここを変更する
fg_hex = "ffffff"

COUNT.times do |i|
  color = colors[i % colors.length]
  bg = [color[0] * 128 + 64, color[1] * 128 + 64, color[2] * 128 + 64]
  bg_hex = bg.map { |c| c.to_i.to_s(16).rjust(2, "0") }.join

  portrait_image =
    HTTP.get(
      "https://dummyimage.com/200x320/#{bg_hex}/#{fg_hex}.png&text=#{i + 1}"
    )
  File.write("portrait_#{i + 1}.png", portrait_image.body, mode: "wb")
  icon_image =
    HTTP.get(
      "https://dummyimage.com/128x128/#{bg_hex}/#{fg_hex}.png&text=#{i + 1}"
    )
  File.write("icon_#{i + 1}.png", icon_image.body, mode: "wb")
end
```
