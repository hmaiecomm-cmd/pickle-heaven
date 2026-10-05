/**
 * 讓驗證腳本能在 Next 之外執行。
 *
 * server-only 這個套件被設計成在非 Server Component 環境載入時直接拋錯，
 * 所以 tsx 跑測試時會失敗。這裡預先在 require 快取塞入一個空模組，
 * 真正的實作就不會被執行到。僅供 scripts/ 內的驗證腳本使用。
 */
const id = require.resolve('server-only')
require.cache[id] = { id, filename: id, loaded: true, exports: {}, children: [], paths: [] }
