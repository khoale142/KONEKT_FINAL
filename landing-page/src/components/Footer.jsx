import { Coffee } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#263426] py-12 text-[#d0e0d3]">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2 text-[#fcfbfa]">
            <Coffee size={24} />
            <span className="text-xl font-bold tracking-tight">KonektPOS</span>
          </div>
          <p className="text-sm">
            © 2026 KonektPOS. Được tối ưu hóa cho ngành F&B.
          </p>
        </div>
      </div>
    </footer>
  );
}
