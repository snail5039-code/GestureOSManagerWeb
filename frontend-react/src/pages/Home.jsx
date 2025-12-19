import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <h1>메인</h1>

      <p>원하는 기능 페이지 이동:</p>

      <ul>
        <li><Link to="/test">서버 연결 테스트</Link></li>
        <li><Link to="/camera">카메라</Link></li>
        {/*나중에 추가 해야함*/}
      </ul>
    </div>
  );
}