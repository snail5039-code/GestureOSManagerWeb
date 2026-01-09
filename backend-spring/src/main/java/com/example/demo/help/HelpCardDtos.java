package com.example.demo.help;

import java.util.List;

public class HelpCardDtos {

	// help-cards.json 전체 구조
	public static class HelpCardsFile {
		public String version;
		public String updatedAt;
		public List<HelpCard> cards;
	}

	// 카드 한 장 구조
	public static class HelpCard {
		public String id;
		public String category;
		public String title;
		public List<String> symptoms;
		public List<String> quickChecks;
		public List<Step> steps;
		public List<Link> links;
		public List<String> tags;
	}

	public static class Step {
		public String label;
		public String detail;
	}

	public static class Link {
		public String label;
		public String url;
	}

	// 챗 요청/응답
	public static class ChatRequest {
		public String message;
		public Context context;
		public List<HistoryItem> history;

		public static class Context {
			public String category;
			public String lastQuestionType;
			public String lang;
		}

		public static class HistoryItem {
			public String role;
			public String text;

			public HistoryItem() {
			}

			public HistoryItem(String role, String text) {
				this.role = role;
				this.text = text;
			}
		}
	}

	public static class ChatResponse {
		public String type; // "cards"
		public String text; // 안내 문구(대화 응답)
		public List<String> matched; // 추천 카드 id 목록 (없으면 [])
		public String nextQuestionType;
	}
}
