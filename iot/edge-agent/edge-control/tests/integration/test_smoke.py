from tests.conftest import H


def test_health_and_status(env):
    r = env.client.get("/v1/health")
    assert r.status_code == 200 and r.json()["status"] == "ok" and r.json()["mock"] is True
    r = env.client.get("/v1/system/status", headers=H["viewer"])
    assert r.status_code == 200
    assert r.json()["simulation_mapping"] is True
    assert r.json()["cloud"]["enabled"] is False
