# Six cameras (fixed order; `config/examples/cameras.yaml`)

| # | camera_id | Name | Location / scope |
|---|---|---|---|
| 01 | camera-01 | 入口密碼鎖攝影機 | 入口密碼鎖所在入口處 · 監看入口處 |
| 02 | camera-02 | 門內入口攝影機 | 門口內側 · 監看入口內側 |
| 03 | camera-03 | 休息區攝影機 | 監看休息區全場及 Pro Shop 入口 |
| 04 | camera-04 | 球場 A 攝影機 | 監看球場 A |
| 05 | camera-05 | Pro Shop 室內攝影機 | 監看 Pro Shop 內部，包含辦公室入口 |
| 06 | camera-06 | 球場 B 攝影機 | 監看球場 B |

01–06 are logical numbers, **not** NVR channels, ISAPI track ids, SDK channels or RTSP stream ids. Real mapping is `null` / `unbound`;
the mock mapping (six simulated channels) is flagged `simulation_only`. camera-05 has no mock recordings on purpose (tests "no recording").
camera-01 gets no QR/OCR/person-recognition features. Live and history are verified separately (`live_verified_at` vs `history_verified_at`).
