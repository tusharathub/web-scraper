import unittest
from pipeline import PipelineCleaner, CleaningConfig, PipelineAnalyzer

class TestPipeline(unittest.TestCase):
    def test_cleaner_lowercase(self):
        config = CleaningConfig(lowercase=True, normalize_whitespace=True)
        raw = ["Hello World!", "  SPACES  "]
        cleaned = PipelineCleaner.clean_elements(raw, config)
        self.assertEqual(cleaned, ["hello world!", "spaces"])

    def test_cleaner_punctuation(self):
        config = CleaningConfig(remove_punctuation=True, normalize_whitespace=True)
        raw = ["Hello, World!!!", "Cleaned. text?"]
        cleaned = PipelineCleaner.clean_elements(raw, config)
        self.assertEqual(cleaned, ["Hello World", "Cleaned text"])

    def test_cleaner_stopwords(self):
        config = CleaningConfig(remove_stopwords=True, normalize_whitespace=True)
        raw = ["This is a test message", "To check the stopwatch"]
        cleaned = PipelineCleaner.clean_elements(raw, config)
        # In pipeline.py, stopwords removal converts words to lowercase and filters.
        # "This", "is", "a", "To", "the" are stopwords.
        self.assertEqual(cleaned, ["test message", "check stopwatch"])

    def test_cleaner_deduplicate(self):
        config = CleaningConfig(deduplicate=True, normalize_whitespace=True)
        raw = ["same text", "another text", "same text"]
        cleaned = PipelineCleaner.clean_elements(raw, config)
        self.assertEqual(cleaned, ["same text", "another text"])

    def test_cleaner_min_length(self):
        config = CleaningConfig(min_line_length=10, normalize_whitespace=True)
        raw = ["short", "long sentence here", "abc"]
        cleaned = PipelineCleaner.clean_elements(raw, config)
        self.assertEqual(cleaned, ["long sentence here"])

    def test_metrics(self):
        elements = ["This is a sentence.", "And here is another one!"]
        metrics = PipelineAnalyzer.calculate_basic_metrics(elements)
        self.assertEqual(metrics["word_count"], 9)
        self.assertEqual(metrics["sentence_count"], 2)

if __name__ == "__main__":
    unittest.main()
