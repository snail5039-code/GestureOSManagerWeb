package com.example.demo.config;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class SignalingHandler extends TextWebSocketHandler {
	private final ObjectMapper om = new ObjectMapper();

	private final Map<String, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();

	private final Map<String, String> sessionRoom = new ConcurrentHashMap<>();

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		String roomId = sessionRoom.remove(session.getId());
		
		if(roomId != null) {
			Set<WebSocketSession> set = rooms.get(roomId);
			if(set != null) {
				set.remove(session);
				
				if(set.isEmpty()) {
					rooms.remove(roomId);
				}
			}
		}
	}

	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
		JsonNode json = om.readTree(message.getPayload());

		String type = json.path("type").asText();

		System.out.println("[WS] recv type=" + type + " payload=" + message.getPayload());

		if ("join".equals(type)) {
			String roomId = json.path("roomId").asText();

			rooms.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
			sessionRoom.put(session.getId(), roomId);

			String ack = om.createObjectNode().put("type", "join_ok").put("roomId", roomId)
					.put("sessionId", session.getId()).toString();
			session.sendMessage(new TextMessage(ack));

			int count = rooms.get(roomId).size();
			String info = om.createObjectNode().put("type", "room_info").put("roomId", roomId).put("count", count)
					.toString();
			session.sendMessage(new TextMessage(info));

			System.out.println("[WS] join room=" + roomId + " count=" + count);

			return;
		}
		String roomId = sessionRoom.get(session.getId());

		if (roomId == null)
			return;

		if ("offer".equals(type) || "answer".equals(type) || "ice".equals(type) || "caption".equals(type) || "chat".equals(type) || "ready".equals(type)) {
			broadcastToRoomExcept(roomId, session, message.getPayload());
		}
	}

	private void broadcastToRoomExcept(String roomId, WebSocketSession sender, String payload) {
		Set<WebSocketSession> set = rooms.get(roomId);
		if (set == null)
			return;

		for (WebSocketSession s : set) {
			if (!s.isOpen())
				continue;

			if (s.getId().equals(sender.getId()))
				continue;
			try {
				s.sendMessage(new TextMessage(payload));
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}
	
}
