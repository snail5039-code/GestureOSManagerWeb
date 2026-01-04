package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true) // ✅ 추가: candidates 같은 필드 와도 파싱 안 터짐
public class TranslateResponse {

  @JsonProperty("label")
  @JsonAlias({"word_id", "wordId", "id"})
  private String label;

  private String text;
  private double confidence;

  @JsonProperty("frames_received")
  @JsonAlias({"framesReceived"})
  private Integer framesReceived;

  private String mode;
  private Integer streak;

  private KcisaItem kcisa;
}
