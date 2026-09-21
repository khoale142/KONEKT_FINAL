import { Coffee } from 'lucide-react';

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[#d0e0d3]/30 bg-[#fcfbfa]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-[#3c5642]">
          <Coffee size={24} strokeWidth={2} />
          <span className="text-xl font-bold tracking-tight">KonektPOS</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="http://localhost:5173/login"
            className="text-sm font-semibold text-[#496951] transition-colors hover:text-[#263426]"
          >
            Đăng nhập
          </a>
          <a
            href="http://localhost:5173/register"
            className="rounded-full bg-[#3c5642] px-5 py-2.5 text-sm font-semibold text-[#fcfbfa] transition-transform hover:scale-105"
          >
            Đăng ký miễn phí
          </a>
        </div>
      </div>
    </nav>
  );
}
