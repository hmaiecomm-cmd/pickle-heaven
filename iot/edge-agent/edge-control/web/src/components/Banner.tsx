/** Persistent banners: mock runtime mode and simulation-only mapping. */
export function Banner({ mode, simulationMapping }: { mode?: string; simulationMapping?: boolean }) {
  return (
    <>
      {mode === 'mock' && (
        <div className="banner banner-sim" role="status">
          <strong>模擬模式：結果不代表真實硬體</strong>
        </div>
      )}
      {simulationMapping && (
        <div className="banner banner-sim" role="status">
          <strong>目前使用「模擬位址映射」（simulation_mapping）</strong>：迴路與控制器皆為模擬，不會驅動任何實體輸出。
        </div>
      )}
    </>
  );
}
