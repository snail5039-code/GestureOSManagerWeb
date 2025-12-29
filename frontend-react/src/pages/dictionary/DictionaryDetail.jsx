import { Link, useParams } from "react-router-dom";
import { MOCK } from "./mockDictionary";

export default function DictionaryDetail() {
    const {id} = useParams();
    const item = MOCK.find((x) => x.id === id);

    if (!item) {
        return (
            <div style={{padding: 16}}>
                <p>해당 단어 없음</p>
                <Link to="/dictionary">검색으로</Link>
            </div>
        );
    }

    return (
        <div style={{ padding: 16}}>
            <Link to="/dictionary">검색으로</Link>
            <h2 style={{ marginTop: 12}}>{item.word}</h2>4
            <p>{item.meaning}</p>
            <p style={{ opacity: 0.7, fontSize: 13}}>카테고리: {item.category}</p>
            <h4 style={{ marginTop: 20}}>에문</h4>
            <ul>
                {item.examples?.map((ex, idx) => (
                    <li key={idx}>{ex}</li>
                ))}
            </ul>
            <h4 style={{ marginTop: 20}}>예시 영상</h4>
            {item.media?.videoUrl ? (
                <video width="100%" controls>
                    <source src={item.media.videoUrl}/>
                </video>
            ) : item.media?.gifUrl ? (
                <img src={item.media.gifUrl} alt="gif" style={{ width: "100%"}}></img>
            ) : (
                <div style={{ opacity: 0.7}}>미디어 없음</div>
            )}
        </div>
    );
}