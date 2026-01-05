import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const FindLoginId = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFindLoginId = async () => {
        if (!name.trim()) {
            alert('이름을 입력해주세요.');
            return;
        }
        if (!email.trim()) {
            alert('이메일을 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8080/api/members/findLoginId', {
                name,
                email
            });
            const { message, loginId } = response.data;
            alert(`${message}`);
            navigate('/login');
        } catch (error) {
            console.error(error);
            const errMsg = error.response?.data?.message || '아이디 찾기 실패';
            alert(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page" style={{ padding: '40px 0', minHeight: '80vh' }}>
            <div className="container" style={{ maxWidth: '720px', margin: '0 auto' }}>
                <div className="auth-wrap">
                    <div className="card auth-card" style={{
                        padding: '26px',
                        backgroundColor: '#fff',
                        borderRadius: '16px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                    }}>
                        <h1 className="auth-title" style={{
                            margin: 0,
                            fontSize: '32px',
                            fontWeight: 900,
                            textAlign: 'center'
                        }}>아이디 찾기</h1>
                        <p className="auth-sub" style={{
                            margin: '10px 0 0',
                            color: '#64748b',
                            fontWeight: 700,
                            textAlign: 'center'
                        }}>가입 시 등록한 이름과 이메일을 입력해 주세요.</p>

                        <div className="auth-form" style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="name" style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>이름</label>
                                <input
                                    id="name"
                                    type="text"
                                    placeholder="이름을 입력하세요"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0'
                                    }}
                                />
                            </div>

                            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="email" style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>이메일</label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="example@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0'
                                    }}
                                />
                            </div>

                            <div className="auth-actions" style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                    className="btn btn-primary"
                                    type="button"
                                    onClick={handleFindLoginId}
                                    disabled={loading}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#4f46e5',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {loading ? '전송 중...' : '아이디 찾기'}
                                </button>
                                <button
                                    className="btn"
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#f1f5f9',
                                        color: '#0f172a',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    뒤로가기
                                </button>
                            </div>

                            <div className="auth-links" style={{
                                marginTop: '14px',
                                display: 'flex',
                                gap: '14px',
                                justifyContent: 'center',
                                color: '#64748b',
                                fontWeight: 700
                            }}>
                                <Link to="/findLoginPw" style={{ textDecoration: 'none', color: 'inherit' }}>비밀번호 찾기</Link>
                                <span style={{ opacity: '.35' }}>|</span>
                                <Link to="/login" style={{ textDecoration: 'none', color: 'inherit' }}>로그인</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FindLoginId;