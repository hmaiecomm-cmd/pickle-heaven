"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";
import { brand } from "@/config/site";
import { cn } from "@/lib/utils";
import { useCartCount } from "@/store/cart";
import { useLiff } from "@/components/liff-provider";

/** 導覽連結只指向既有功能或首頁區塊 */
const LINKS = [
  { href: "/booking", label: "場地預約" },
  { href: "/#coaching", label: "課程體驗" },
  { href: "/sessions", label: "活動" },
  { href: "/#story", label: "關於我們" },
  { href: "/#visit", label: "交通資訊" },
] as const;

/**
 * 首頁導覽列：首屏時透明疊在主視覺上，往下捲動後變成暖白實色。
 * 手機版用全螢幕深紫選單。後台連結只在已登入後台時出現。
 */
export function HomeNav({ isAdmin }: { isAdmin: boolean }) {
  const cartCount = useCartCount();
  const { user, login, loggingIn } = useLiff();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 手機選單：鎖住背景捲動、Esc 關閉並把焦點還給按鈕、開啟時焦點移到第一個連結
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const solid = scrolled || open;
  const close = () => setOpen(false);
  const hoverBg = solid ? "hover:bg-hp-lilac" : "hover:bg-white/15";

  const memberEntry = user ? (
    <Link
      href="/account"
      onClick={close}
      className="hp-focus flex items-center gap-2 rounded-full text-sm font-semibold"
    >
      {user.pictureUrl ? (
        // LINE 頭像來自外部 CDN，以 img 呈現
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.pictureUrl}
          alt=""
          className="h-8 w-8 rounded-full object-cover ring-2 ring-white/60"
        />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-hp-lilac text-xs font-bold text-hp-deep">
          {user.displayName.slice(0, 1)}
        </span>
      )}
      <span>會員中心</span>
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => {
        close();
        void login();
      }}
      disabled={loggingIn}
      className="hp-focus min-h-11 rounded-full px-2 text-sm font-semibold underline-offset-4 hover:underline disabled:opacity-50"
    >
      {loggingIn ? "登入中…" : "會員登入"}
    </button>
  );

  // 選單面板放在 header 外：header 的 backdrop-blur 會讓內部 fixed 元素以 header 為定位範圍
  return (
    <>
      <header
        className={cn(
          "hp-nav fixed inset-x-0 top-0 z-50 pt-safe",
          solid
            ? "bg-hp-cream/95 text-hp-ink shadow-[0_8px_30px_-20px_rgb(33_26_43/.5)] backdrop-blur"
            : "hp-on-dark text-white",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[84rem] items-center gap-3 px-[var(--hp-gutter)] lg:h-[4.5rem]">
          <Link
            href="/"
            className="hp-focus mr-auto flex flex-col rounded-md leading-none"
            aria-label={brand.name + " 首頁"}
          >
            <span className="whitespace-nowrap text-[1.05rem] font-extrabold tracking-[0.04em] sm:text-lg">
              {brand.name}
            </span>
            <span
              className={cn(
                "mt-1 whitespace-nowrap font-display text-[0.58rem] font-semibold tracking-[0.22em]",
                solid ? "text-hp-purple" : "text-white/80",
              )}
            >
              {brand.englishName}
            </span>
          </Link>

          <nav aria-label="主要導覽" className="hidden lg:block">
            <ul className="flex items-center gap-0.5">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={cn(
                      "hp-focus rounded-full px-3.5 py-2 text-[0.95rem] font-semibold transition-colors",
                      hoverBg,
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "hp-focus hidden rounded-full border px-3 py-1 text-xs font-semibold lg:inline-block",
                  solid ? "border-hp-ink/30" : "border-white/50",
                )}
              >
                後台
              </Link>
            )}
            <Link
              href="/cart"
              aria-label={
                cartCount > 0 ? `購物車，${cartCount} 個項目` : "購物車"
              }
              className={cn(
                "hp-focus relative grid h-11 w-11 place-items-center rounded-full transition-colors",
                hoverBg,
              )}
            >
              <ShoppingBag className="h-5 w-5" aria-hidden />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-hp-purple px-1 text-[0.65rem] font-bold text-white tabular">
                  {cartCount}
                </span>
              )}
            </Link>
            <div className="hidden lg:block">{memberEntry}</div>
            {/* .hp-btn 自帶 display，響應式隱藏要放在外層 */}
            <span className="hidden sm:block">
              <Link href="/booking" className="hp-btn hp-btn-primary hp-btn-sm">
                預約開打
              </Link>
            </span>
            <button
              ref={toggleRef}
              type="button"
              className={cn(
                "hp-focus grid h-11 w-11 place-items-center rounded-full lg:hidden",
                hoverBg,
              )}
              aria-expanded={open}
              aria-controls="hp-mobile-menu"
              aria-label={open ? "關閉選單" : "開啟選單"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? (
                <X className="h-6 w-6" aria-hidden />
              ) : (
                <Menu className="h-6 w-6" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div
          id="hp-mobile-menu"
          ref={menuRef}
          className="hp-on-dark fixed inset-x-0 z-50 bottom-0 top-[calc(4rem+env(safe-area-inset-top))] overflow-y-auto bg-hp-deep px-[var(--hp-gutter)] pb-10 pt-6 text-white lg:hidden"
        >
          <nav aria-label="手機選單">
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={close}
                    className="hp-focus flex items-center justify-between py-4 text-xl font-bold"
                  >
                    {l.label}
                    <span aria-hidden className="text-white/40">
                      →
                    </span>
                  </Link>
                </li>
              ))}
              {isAdmin && (
                <li>
                  <Link
                    href="/admin"
                    onClick={close}
                    className="hp-focus flex py-4 text-base font-semibold text-white/80"
                  >
                    後台管理
                  </Link>
                </li>
              )}
            </ul>
          </nav>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/booking"
              onClick={close}
              className="hp-btn hp-btn-light w-full"
            >
              預約開打
            </Link>
            <div className="flex justify-center py-2">{memberEntry}</div>
          </div>
        </div>
      )}
    </>
  );
}
