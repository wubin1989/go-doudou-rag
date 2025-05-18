package utils

import "testing"

func TestGenerateBase64URLSafeSHA256ID(t *testing.T) {
	type args struct {
		text string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := GenerateBase64URLSafeSHA256ID(tt.args.text); got != tt.want {
				t.Errorf("GenerateBase64URLSafeSHA256ID() = %v, want %v", got, tt.want)
			}
		})
	}
}
