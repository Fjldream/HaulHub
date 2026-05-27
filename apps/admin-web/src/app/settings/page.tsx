import { AdminShell } from "@/components/admin/admin-shell";

export default function SettingsPage() {
  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>系统设置</h1>
          <p>第一版保留基础设置入口，后续扩展账号、安全和存储配置。</p>
        </div>
      </section>
      <section className="panel settings-list">
        <div>
          <strong>票据存储</strong>
          <span>本地目录，后续可迁移对象存储</span>
        </div>
        <div>
          <strong>金额精度</strong>
          <span>人民币，两位小数，decimal 存储</span>
        </div>
        <div>
          <strong>司机端隐私</strong>
          <span>不展示运费、利润、利润率和经营报表</span>
        </div>
      </section>
    </AdminShell>
  );
}
