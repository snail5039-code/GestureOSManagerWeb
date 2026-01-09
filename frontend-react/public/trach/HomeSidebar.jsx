// import React, { useState } from "react";
// import { useAuth } from "../../auth/AuthProvider";

// export default function HomeSidebar() {
//     const { user } = useAuth();
//     const [isMinimized, setIsMinimized] = useState(false);
//     const [messages, setMessages] = useState([
//         { role: "assistant", text: "안녕하세요! 무엇을 도와드릴까요?" }
//     ]);
//     const [input, setInput] = useState("");

//     const handleSend = () => {
//         if (!input.trim()) return;
//         setMessages([...messages, { role: "user", text: input }]);
//         setInput("");
//         // AI 응답 시뮬레이션
//         setTimeout(() => {
//             setMessages(prev => [...prev, { role: "assistant", text: "수어 번역을 시작하시겠습니까?" }]);
//         }, 1000);
//     };

//     if (isMinimized) {
//         return (
//             <button
//                 onClick={() => setIsMinimized(false)}
//                 className="fixed right-0 top-1/2 -translate-y-1/2 w-12 h-32 bg-indigo-600 text-white rounded-l-3xl flex items-center justify-center shadow-2xl hover:w-14 transition-all z-40"
//             >
//                 <span className="[writing-mode:vertical-lr] font-black tracking-widest">최소화</span>
//             </button>
//         );
//     }

//     return (
//         <aside className="w-[400px] bg-white border-l border-slate-200 flex flex-col animate-fade-in relative">
//             {/* 최소화 버튼 */}
//             <button
//                 onClick={() => setIsMinimized(true)}
//                 className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-24 bg-slate-200 hover:bg-slate-300 rounded-l-xl flex items-center justify-center transition-colors"
//             >
//                 <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
//                 </svg>
//             </button>

//             {/* 상단 닫기 버튼 (와이어프레임 X) */}
//             <div className="p-6 flex justify-end">
//                 <button className="text-slate-300 hover:text-slate-500 transition-colors">
//                     <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                     </svg>
//                 </button>
//             </div>

//             {/* 사용자 정보 */}
//             <div className="px-6 mb-8">
//                 <div className="glass p-6 rounded-[2rem] border-slate-100 flex items-center gap-4">
//                     <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
//                         <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
//                             <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
//                         </svg>
//                     </div>
//                     <div>
//                         <h4 className="text-xl font-black text-slate-800 tracking-tight">
//                             {user?.nickname || user?.name || "사용자"}
//                         </h4>
//                         <p className="text-sm font-bold text-slate-400">Premium Member</p>
//                     </div>
//                 </div>
//             </div>

//             {/* 실시간 챗봇 */}
//             <div className="flex-1 px-6 flex flex-col min-h-0">
//                 <div className="flex items-center justify-between mb-4">
//                     <h5 className="text-sm font-black text-slate-400 uppercase tracking-widest">실시간 챗봇</h5>
//                     <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">LIVE</span>
//                 </div>

//                 <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
//                     {messages.map((msg, idx) => (
//                         <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
//                             <div className={`max-w-[80%] p-4 rounded-2xl font-bold text-sm shadow-sm ${msg.role === 'user'
//                                     ? 'bg-indigo-600 text-white rounded-tr-none'
//                                     : 'bg-slate-100 text-slate-700 rounded-tl-none'
//                                 }`}>
//                                 {msg.text}
//                             </div>
//                         </div>
//                     ))}
//                 </div>
//             </div>

//             {/* 텍스트 입력칸 */}
//             <div className="p-6">
//                 <div className="relative">
//                     <input
//                         type="text"
//                         value={input}
//                         onChange={(e) => setInput(e.target.value)}
//                         onKeyDown={(e) => e.key === 'Enter' && handleSend()}
//                         placeholder="메시지를 입력하세요..."
//                         className="w-full pl-6 pr-16 py-5 bg-slate-100 border-none rounded-[2rem] font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//                     />
//                     <button
//                         onClick={handleSend}
//                         className="absolute right-2 top-2 bottom-2 w-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
//                     >
//                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
//                         </svg>
//                     </button>
//                 </div>
//             </div>
//         </aside>
//     );
// }
