import { Package, Users, LineChart, Coffee } from 'lucide-react';

export function FeaturesBento() {
  return (
    <section id="features" className="bg-[#fcfbfa] py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-4xl font-bold tracking-tight text-[#263426] md:text-5xl">
            Được thiết kế cho tốc độ và sự chính xác
          </h2>
          <p className="mt-6 text-lg text-[#6f786b]">
            Dẹp bỏ các thao tác rườm rà. Hệ thống tập trung giải quyết triệt để vấn đề vận hành của quán cà phê với giao diện tối giản.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-stretch">
          {/* Card 1: POS Interface */}
          <div className="group relative overflow-hidden rounded-2xl mb-30 bg-[#f4eee4] p-8 md:col-span-3">
            <div className="flex h-full flex-col justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-md md:w-1/2">
                <Coffee className="mb-4 text-[#3c5642]" size={32} />
                <h3 className="text-2xl font-bold text-[#263426]">
                  Giao diện thu ngân siêu tốc
                </h3>
                <p className="mt-2 text-[#6f786b]">
                  Lên đơn, tùy chỉnh topping, và thanh toán chỉ trong vài cú chạm.
                  Không để khách hàng phải chờ đợi.
                </p>
              </div>

              <div className="relative -mb-8 -mr-8 overflow-hidden rounded-tl-xl border-l border-t border-[#d0e0d3] shadow-lg transition-transform duration-500 group-hover:-translate-x-2 group-hover:-translate-y-2 md:-my-8 md:w-1/2">
                <img
                  src="/pos-interface.jpg"
                  alt="POS Interface"
                  className="w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Inventory */}
          <div className="flex h-full flex-col justify-between rounded-2xl bg-[#d0e0d3] p-8">
            <div>
              <Package className="mb-4 text-[#3c5642]" size={32} />
              <h3 className="text-2xl font-bold text-[#263426]">
                Kho & Định mức
              </h3>
              <p className="mt-2 text-[#496951]">
                Tự động trừ kho theo công thức pha chế. Nhận cảnh báo ngay khi
                nguyên liệu sắp hết.
              </p>
            </div>
          </div>

          {/* Card 3: Reports */}
          <div className="flex h-full flex-col justify-between rounded-2xl bg-[#3c5642] p-8">
            <div>
              <LineChart className="mb-4 text-[#d0e0d3]" size={32} />
              <h3 className="text-2xl font-bold text-[#fcfbfa]">
                Báo cáo trực quan
              </h3>
              <p className="mt-2 text-[#a3bfa8]">
                Nắm bắt doanh thu, lợi nhuận, và món bán chạy theo thời gian thực
                mọi lúc mọi nơi.
              </p>
            </div>
          </div>

          {/* Card 4: Multi-tenant / HR */}
          <div className="flex h-full flex-col justify-between rounded-2xl border border-[#d0e0d3] bg-[#fcfbfa] p-8">
            <div className="max-w-md">
              <Users className="mb-4 text-[#3c5642]" size={32} />
              <h3 className="text-2xl font-bold text-[#263426]">
                Quản lý chuỗi & Nhân sự
              </h3>
              <p className="mt-2 text-[#6f786b]">
                Theo dõi hiệu suất từng chi nhánh, phân ca làm việc, chấm công và
                tính lương tự động trên cùng một hệ thống.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
