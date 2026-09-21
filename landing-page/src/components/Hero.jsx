export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#f4eee4] pt-24 pb-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-8">
            <div className="inline-flex items-center rounded-full border border-[#597d62]/20 bg-[#d0e0d3]/50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#3c5642] self-start">
              Quản lý Cà phê Thông minh
            </div>
            <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-[#263426] md:text-6xl">
              Kiểm soát mọi thứ.<br />
              <span className="text-[#496951]">Từ quầy pha chế đến kho hàng.</span>
            </h1>
            <p className="max-w-[500px] text-lg leading-relaxed text-[#6f786b]">
              KonektPOS là nền tảng bán hàng và quản lý kho được thiết kế riêng cho các quán cà phê đặc sản. Tối ưu hóa vận hành, chống thất thoát và gia tăng lợi nhuận.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="http://localhost:5173/register"
                className="rounded-full bg-[#3c5642] px-8 py-4 text-base font-semibold text-[#fcfbfa] transition-transform hover:scale-105"
              >
                Trải nghiệm ngay
              </a>
              <a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-base font-semibold text-[#496951] underline-offset-4 hover:underline"
              >
                Xem tính năng
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="relative z-10 overflow-hidden rounded-2xl border border-[#d0e0d3] shadow-2xl">
              <img 
                src="/dashboard-mockup.jpg" 
                alt="KonektPOS Dashboard" 
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="absolute -right-20 -top-20 z-0 h-[400px] w-[400px] rounded-full bg-[#e6d8c0] blur-3xl opacity-60"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
